"""
Olympus Health Tools for LangGraph Agent

These tools are ported from the MCP server (mcp-server/src/index.ts).
They query the same CockroachDB database and return health data
for the Llama LLM to analyze.

KEY CONCEPT (for new grads):
- LangGraph tools use the @tool decorator from langchain_core
- The docstring becomes the tool's description (the LLM reads this!)
- Type hints + docstring = automatic schema generation
- The LLM decides WHEN to call each tool based on the description
"""

from __future__ import annotations

import json
import math
import os
from datetime import datetime, timedelta
from typing import Literal, Optional

import psycopg
from langchain_core.tools import tool

# =============================================================================
# LAZY LOADING FOR ENVIRONMENT VARIABLES
# =============================================================================
# WHY: Python executes module-level code at IMPORT time, not at runtime.
# If we do `DATABASE_URL = os.getenv("DATABASE_URL")` at the top of the file,
# it runs BEFORE cli.py has a chance to load the .env file.
#
# SOLUTION: Read env vars inside functions (lazy loading). This ensures
# they're read AFTER dotenv has loaded the .env file.
# =============================================================================


def get_connection() -> psycopg.Connection:
    """Get a database connection. Called fresh for each tool invocation."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL environment variable not set")
    return psycopg.connect(database_url)


def get_user_id() -> str:
    """Get the current user ID from environment (lazy loaded)."""
    user_id = os.getenv("OLYMPUS_USER_ID")
    if not user_id:
        raise RuntimeError("OLYMPUS_USER_ID environment variable not set")
    return user_id


def get_user_timezone() -> str:
    """Get the user's timezone from their settings."""
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT settings->>'timezone' as timezone
                FROM users
                WHERE id = %s
                """,
                (get_user_id(),),
            )
            row = cur.fetchone()
            return row[0] if row and row[0] else "UTC"


def get_today_date_str(timezone: str) -> str:
    """Get today's date as YYYY-MM-DD in the user's timezone."""
    # For simplicity, we use UTC and let the DB handle timezone conversion
    # In production, you'd use pytz or zoneinfo for proper timezone handling
    return datetime.now().strftime("%Y-%m-%d")


# =============================================================================
# WEB SEARCH TOOL
# =============================================================================


@tool
def search_web(query: str, max_results: int = 5) -> dict:
    """Search the web for nutrition, micronutrient, and health information.

    Use this tool when you need detailed information about:
    - Micronutrient content of foods (vitamins, minerals)
    - Recommended daily allowances (RDAs) for nutrients
    - Health benefits of specific nutrients
    - Supplement information
    - Food-nutrient interactions

    Args:
        query: The search query (e.g., "vitamin D benefits", "iron rich foods")
        max_results: Maximum number of results to return (default 5, max 10)

    Returns:
        Search results with titles, snippets, and URLs
    """
    try:
        from duckduckgo_search import DDGS
    except ImportError:
        return {
            "error": "duckduckgo-search not installed. Run: pip install duckduckgo-search"
        }

    max_results = min(max(max_results, 1), 10)  # Clamp between 1 and 10

    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))

        if not results:
            return {"message": "No results found for your query", "results": []}

        return {
            "query": query,
            "count": len(results),
            "results": [
                {
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", ""),
                }
                for r in results
            ],
        }
    except Exception as e:
        return {"error": f"Search failed: {str(e)}"}


# =============================================================================
# TOOL 1: GET SLEEP SUMMARY
# This is a read-only tool that fetches sleep data from the database
# =============================================================================


@tool
def get_sleep_summary(days: int = 7) -> dict:
    """Get detailed sleep data including duration, stages, scores, and efficiency.

    Use this tool when the user asks about their sleep quality, sleep patterns,
    how well they slept, or anything related to rest and recovery.

    Args:
        days: Number of nights to look back (default 7, max 30)

    Returns:
        Summary with average sleep metrics and individual night details including:
        - Total hours slept
        - Sleep score (0-100)
        - Deep sleep, REM sleep, light sleep minutes
        - Sleep efficiency percentage
        - Bedtime and wake time
    """
    days = min(max(days, 1), 30)  # Clamp between 1 and 30

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    sleep_date,
                    total_minutes,
                    in_bed_minutes,
                    deep_sleep_minutes,
                    rem_sleep_minutes,
                    light_sleep_minutes,
                    awake_minutes,
                    sleep_score,
                    efficiency,
                    bedtime,
                    wake_time
                FROM sleep_sessions
                WHERE user_id = %s
                ORDER BY sleep_date DESC
                LIMIT %s
                """,
                (get_user_id(), days),
            )
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

    if not rows:
        return {"message": "No sleep data found", "data": []}

    # Convert rows to dicts
    sleep_data = [dict(zip(columns, row)) for row in rows]

    # Calculate averages
    total_minutes = [s["total_minutes"] or 0 for s in sleep_data]
    scores = [s["sleep_score"] for s in sleep_data if s["sleep_score"]]
    deep_minutes = [s["deep_sleep_minutes"] or 0 for s in sleep_data]
    rem_minutes = [s["rem_sleep_minutes"] or 0 for s in sleep_data]

    avg_minutes = sum(total_minutes) / len(total_minutes) if total_minutes else 0
    avg_score = sum(scores) / len(scores) if scores else None
    avg_deep = sum(deep_minutes) / len(deep_minutes) if deep_minutes else 0
    avg_rem = sum(rem_minutes) / len(rem_minutes) if rem_minutes else 0

    return {
        "summary": {
            "averageSleepHours": round(avg_minutes / 60, 1),
            "averageScore": round(avg_score) if avg_score else None,
            "averageDeepMinutes": round(avg_deep),
            "averageRemMinutes": round(avg_rem),
            "nightsTracked": len(sleep_data),
        },
        "nights": [
            {
                "date": str(s["sleep_date"]),
                "hoursSlept": round((s["total_minutes"] or 0) / 60, 1),
                "score": s["sleep_score"],
                "deepMinutes": s["deep_sleep_minutes"],
                "remMinutes": s["rem_sleep_minutes"],
                "efficiency": (
                    f"{float(s['efficiency']):.0f}%" if s["efficiency"] else None
                ),
                "bedtime": str(s["bedtime"]) if s["bedtime"] else None,
                "wakeTime": str(s["wake_time"]) if s["wake_time"] else None,
            }
            for s in sleep_data
        ],
    }


# =============================================================================
# TOOL 2: GET TODAY'S METRICS
# =============================================================================


@tool
def get_todays_metrics() -> dict:
    """Get today's health metrics including steps, calories, exercise, HRV, and heart rate.

    Use this tool when the user asks about their current day's activity like:
    - "How many steps today?"
    - "What's my HRV?"
    - "How active have I been?"

    Returns:
        Today's metrics including steps, active calories, exercise minutes,
        distance, HRV, resting heart rate, and last night's sleep.
    """
    timezone = get_user_timezone()
    today_str = get_today_date_str(timezone)

    with get_connection() as conn:
        with conn.cursor() as cur:
            # Get cumulative metrics (sum for today)
            cur.execute(
                """
                SELECT
                    metric_type,
                    SUM(CAST(value AS DECIMAL)) as total
                FROM health_metrics
                WHERE user_id = %s
                    AND recorded_at >= CURRENT_DATE
                    AND metric_type IN ('steps', 'calories_active', 'distance', 'exercise_minutes', 'flights_climbed')
                GROUP BY metric_type
                """,
                (get_user_id(),),
            )
            cumulative = {row[0]: float(row[1]) for row in cur.fetchall()}

            # Get point-in-time metrics (most recent)
            cur.execute(
                """
                SELECT DISTINCT ON (metric_type)
                    metric_type,
                    value,
                    recorded_at
                FROM health_metrics
                WHERE user_id = %s
                    AND metric_type IN ('hrv', 'resting_heart_rate', 'respiratory_rate', 'blood_oxygen')
                ORDER BY metric_type, recorded_at DESC
                """,
                (get_user_id(),),
            )
            latest = {
                row[0]: {"value": float(row[1]), "recordedAt": row[2]}
                for row in cur.fetchall()
            }

            # Get today's sleep
            cur.execute(
                """
                SELECT total_minutes, sleep_score, deep_sleep_minutes, rem_sleep_minutes
                FROM sleep_sessions
                WHERE user_id = %s
                    AND sleep_date = %s
                LIMIT 1
                """,
                (get_user_id(), today_str),
            )
            sleep_row = cur.fetchone()

    sleep_data = None
    if sleep_row:
        sleep_data = {
            "hours": round(sleep_row[0] / 60, 1) if sleep_row[0] else 0,
            "score": sleep_row[1],
            "deepMinutes": sleep_row[2],
            "remMinutes": sleep_row[3],
        }

    return {
        "date": today_str,
        "timezone": timezone,
        "steps": round(cumulative.get("steps", 0)),
        "activeCalories": round(cumulative.get("calories_active", 0)),
        "exerciseMinutes": round(cumulative.get("exercise_minutes", 0)),
        "distance": f"{cumulative.get('distance', 0) / 1000:.2f} km",
        "flightsClimbed": round(cumulative.get("flights_climbed", 0)),
        "hrv": (
            f"{round(latest['hrv']['value'])} ms" if "hrv" in latest else "No data"
        ),
        "restingHeartRate": (
            f"{round(latest['resting_heart_rate']['value'])} bpm"
            if "resting_heart_rate" in latest
            else "No data"
        ),
        "sleep": sleep_data or "No sleep data for last night",
    }


# =============================================================================
# TOOL 3: GET HRV TREND
# =============================================================================


@tool
def get_hrv_trend(days: int = 14) -> dict:
    """Get Heart Rate Variability (HRV) trend over time with daily averages.

    HRV is a key indicator of recovery and fitness. Higher HRV generally means
    better recovery. Use this when the user asks about:
    - HRV trends
    - Recovery status
    - Training readiness

    Args:
        days: Number of days to analyze (default 14)

    Returns:
        HRV trend with daily averages, min/max, and trend status (improving/declining/stable)
    """
    start_date = datetime.now() - timedelta(days=days)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    DATE(recorded_at) as date,
                    AVG(CAST(value AS DECIMAL)) as avg_hrv,
                    MIN(CAST(value AS DECIMAL)) as min_hrv,
                    MAX(CAST(value AS DECIMAL)) as max_hrv,
                    COUNT(*) as readings
                FROM health_metrics
                WHERE user_id = %s
                    AND metric_type = 'hrv'
                    AND recorded_at >= %s
                GROUP BY DATE(recorded_at)
                ORDER BY date DESC
                """,
                (get_user_id(), start_date),
            )
            rows = cur.fetchall()

    if not rows:
        return {"message": "No HRV data found", "averageHrv": None, "trend": "unknown"}

    avg_overall = sum(float(r[1]) for r in rows) / len(rows)

    # Simple trend: compare recent 3 days vs older 3 days
    recent = [float(r[1]) for r in rows[:3]]
    older = [float(r[1]) for r in rows[-3:]]
    recent_avg = sum(recent) / len(recent) if recent else 0
    older_avg = sum(older) / len(older) if older else 0

    if older_avg > 0:
        trend_pct = ((recent_avg - older_avg) / older_avg) * 100
        if recent_avg > older_avg * 1.05:
            trend = "improving"
        elif recent_avg < older_avg * 0.95:
            trend = "declining"
        else:
            trend = "stable"
    else:
        trend = "stable"
        trend_pct = 0

    return {
        "summary": {
            "averageHrv": round(avg_overall),
            "trend": trend,
            "trendPercentage": f"{trend_pct:.1f}%",
            "daysTracked": len(rows),
        },
        "dailyAverages": [
            {
                "date": str(r[0]),
                "avgHrv": round(float(r[1])),
                "minHrv": round(float(r[2])),
                "maxHrv": round(float(r[3])),
                "readings": r[4],
            }
            for r in rows
        ],
    }


# =============================================================================
# TOOL 4: GET RECENT WORKOUTS
# =============================================================================


@tool
def get_recent_workouts(days: int = 7) -> dict:
    """Get recent workout data including type, duration, calories, and heart rate.

    Use this when the user asks about:
    - Recent exercise
    - Workout history
    - Training volume

    Args:
        days: Number of days to fetch (default 7)

    Returns:
        List of workouts with summary statistics
    """
    start_date = datetime.now() - timedelta(days=days)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    name,
                    type,
                    duration_minutes,
                    calories_burned,
                    heart_rate_avg,
                    heart_rate_max,
                    started_at
                FROM workouts
                WHERE user_id = %s
                    AND started_at >= %s
                ORDER BY started_at DESC
                """,
                (get_user_id(), start_date),
            )
            rows = cur.fetchall()

    if not rows:
        return {
            "message": "No workouts found in this period",
            "totalWorkouts": 0,
            "workouts": [],
        }

    total_minutes = sum(r[2] or 0 for r in rows)
    total_calories = sum(r[3] or 0 for r in rows)

    return {
        "summary": {
            "totalWorkouts": len(rows),
            "totalMinutes": total_minutes,
            "totalCalories": total_calories,
            "avgDuration": round(total_minutes / len(rows)) if rows else 0,
        },
        "workouts": [
            {
                "name": r[0],
                "type": r[1],
                "duration": f"{r[2]} min" if r[2] else None,
                "calories": r[3],
                "avgHr": r[4],
                "maxHr": r[5],
                "date": str(r[6]) if r[6] else None,
            }
            for r in rows
        ],
    }


# =============================================================================
# TOOL 5: GET HEALTH SUMMARY
# Comprehensive overview - calls multiple internal queries
# =============================================================================


@tool
def get_health_summary() -> dict:
    """Get a comprehensive health overview including today's metrics and weekly averages.

    Use this tool for general health questions like:
    - "How am I doing today?"
    - "Give me a health summary"
    - "What's my overall health status?"

    Returns:
        Complete health snapshot with:
        - Today's metrics (steps, calories, exercise, HRV, heart rate, sleep)
        - Weekly sleep averages
        - Weekly HRV trend
        - Weekly workout summary
    """
    timezone = get_user_timezone()

    today_metrics = get_todays_metrics.invoke({})
    sleep_summary = get_sleep_summary.invoke({"days": 7})
    hrv_trend = get_hrv_trend.invoke({"days": 7})
    workouts = get_recent_workouts.invoke({"days": 7})

    return {
        "generatedAt": datetime.now().isoformat(),
        "timezone": timezone,
        "today": today_metrics,
        "weeklyAverages": {
            "sleep": sleep_summary.get("summary", {}),
            "hrv": hrv_trend.get("summary", {}),
            "workouts": workouts.get("summary", {}),
        },
    }


# =============================================================================
# TOOL 6: GET USER PROFILE
# =============================================================================


@tool
def get_user_profile() -> dict:
    """Get user's profile including height, weight, BMI, age, and health goals.

    Use this when questions involve body metrics or personalized recommendations:
    - "What's my BMI?"
    - "What are my health goals?"
    - "Tell me about my profile"

    Returns:
        User profile with name, age, gender, height, weight, BMI, and goals
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    full_name,
                    date_of_birth,
                    gender,
                    height_cm,
                    weight_kg,
                    settings
                FROM users
                WHERE id = %s
                """,
                (get_user_id(),),
            )
            row = cur.fetchone()

    if not row:
        return {"error": "User not found"}

    full_name, dob, gender, height_cm, weight_kg, settings = row
    settings = settings or {}

    # Calculate age if date of birth is available
    age = None
    if dob:
        dob_date = dob if isinstance(dob, datetime) else datetime.fromisoformat(str(dob))
        today = datetime.now()
        age = today.year - dob_date.year
        if (today.month, today.day) < (dob_date.month, dob_date.day):
            age -= 1

    # Calculate BMI if height and weight are available
    bmi = None
    bmi_category = None
    if height_cm and weight_kg:
        height_m = float(height_cm) / 100
        bmi = round(float(weight_kg) / (height_m * height_m), 1)
        if bmi < 18.5:
            bmi_category = "Underweight"
        elif bmi < 25:
            bmi_category = "Normal"
        elif bmi < 30:
            bmi_category = "Overweight"
        else:
            bmi_category = "Obese"

    return {
        "name": full_name,
        "age": age,
        "gender": gender,
        "height": f"{height_cm} cm" if height_cm else None,
        "weight": f"{weight_kg} kg" if weight_kg else None,
        "bmi": bmi,
        "bmiCategory": bmi_category,
        "goals": {
            "sleepTarget": f"{settings.get('sleepTargetHours', 8)} hours",
            "calorieTarget": settings.get("calorieTarget", 2000),
            "proteinTarget": f"{settings.get('proteinTargetG', 150)}g",
        },
        "timezone": settings.get("timezone", "UTC"),
    }


# =============================================================================
# TOOL 7: GET TODAY'S FOOD LOG
# =============================================================================


@tool
def get_todays_food_log() -> dict:
    """Get everything the user has eaten today, grouped by meal with calories and macros.

    Use this when the user asks:
    - "What did I eat today?"
    - "How many calories today?"
    - "Show my food log"

    Each food item has an 'id' field that can be used with delete_food_log.

    Returns:
        Food items grouped by meal (breakfast, lunch, dinner, snack) with totals
    """
    timezone = get_user_timezone()
    today_str = get_today_date_str(timezone)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    food_name,
                    brand,
                    meal_type,
                    serving_quantity,
                    serving_unit,
                    calories,
                    protein_g,
                    carbs_g,
                    fat_g,
                    fiber_g,
                    sugar_g,
                    sodium_mg,
                    created_at
                FROM food_logs
                WHERE user_id = %s
                    AND logged_date = %s
                ORDER BY created_at ASC
                """,
                (get_user_id(), today_str),
            )
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

    # Group by meal type
    meals: dict = {"breakfast": [], "lunch": [], "dinner": [], "snack": []}
    total_calories = 0
    total_protein = 0
    total_carbs = 0
    total_fat = 0

    for row in rows:
        log = dict(zip(columns, row))
        meal_type = log["meal_type"] or "snack"

        calories = float(log["calories"] or 0)
        protein = float(log["protein_g"] or 0)
        carbs = float(log["carbs_g"] or 0)
        fat = float(log["fat_g"] or 0)

        if meal_type in meals:
            meals[meal_type].append(
                {
                    "id": str(log["id"]),
                    "name": log["food_name"],
                    "brand": log["brand"],
                    "serving": f"{log['serving_quantity']} {log['serving_unit']}",
                    "calories": round(calories),
                    "protein": round(protein),
                    "carbs": round(carbs),
                    "fat": round(fat),
                }
            )

        total_calories += calories
        total_protein += protein
        total_carbs += carbs
        total_fat += fat

    return {
        "date": today_str,
        "timezone": timezone,
        "totals": {
            "calories": round(total_calories),
            "protein": round(total_protein),
            "carbs": round(total_carbs),
            "fat": round(total_fat),
        },
        "meals": meals,
    }


# =============================================================================
# TOOL 8: LOG FOOD (Enhanced with micronutrients)
# =============================================================================


@tool
def log_food(
    food_name: str,
    meal_type: Literal["breakfast", "lunch", "dinner", "snack"],
    serving_description: str,
    calories: int,
    protein_g: float,
    carbs_g: float,
    fat_g: float,
    fiber_g: float = 0,
    sugar_g: float = 0,
    saturated_fat_g: float = 0,
    sodium_mg: float = 0,
    cholesterol_mg: float = 0,
    vitamin_a_mcg: float = 0,
    vitamin_c_mg: float = 0,
    vitamin_d_mcg: float = 0,
    calcium_mg: float = 0,
    iron_mg: float = 0,
    potassium_mg: float = 0,
) -> dict:
    """Log a food item that the user has eaten.

    Use this tool when the user says they ate something, like:
    - "I had 2 eggs for breakfast"
    - "Log a chicken salad for lunch"
    - "I just ate an apple"

    IMPORTANT: You must estimate the nutritional values if the user doesn't provide them.
    Use your knowledge of common foods to provide reasonable estimates.
    For detailed micronutrient info, use search_web first.

    Args:
        food_name: Name of the food (e.g., "Scrambled Eggs", "Grilled Chicken Breast")
        meal_type: Which meal - breakfast, lunch, dinner, or snack
        serving_description: Serving size (e.g., "2 large eggs", "200g", "1 medium apple")
        calories: Total calories for the serving
        protein_g: Protein in grams
        carbs_g: Carbohydrates in grams
        fat_g: Fat in grams
        fiber_g: Fiber in grams (optional)
        sugar_g: Sugar in grams (optional)
        saturated_fat_g: Saturated fat in grams (optional)
        sodium_mg: Sodium in milligrams (optional)
        cholesterol_mg: Cholesterol in milligrams (optional)
        vitamin_a_mcg: Vitamin A in micrograms (optional)
        vitamin_c_mg: Vitamin C in milligrams (optional)
        vitamin_d_mcg: Vitamin D in micrograms (optional)
        calcium_mg: Calcium in milligrams (optional)
        iron_mg: Iron in milligrams (optional)
        potassium_mg: Potassium in milligrams (optional)

    Returns:
        Confirmation with the logged food details
    """
    timezone = get_user_timezone()
    today_str = get_today_date_str(timezone)

    # Parse serving description (e.g., "2 large eggs" -> quantity: 2, unit: "large eggs")
    import re

    match = re.match(r"^([\d.]+)\s*(.+)$", serving_description)
    if match:
        serving_quantity = match.group(1)
        serving_unit = match.group(2)
    else:
        serving_quantity = "1"
        serving_unit = serving_description

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO food_logs (
                    user_id,
                    food_name,
                    meal_type,
                    serving_quantity,
                    serving_unit,
                    serving_size,
                    calories,
                    protein_g,
                    carbs_g,
                    fat_g,
                    fiber_g,
                    sugar_g,
                    saturated_fat_g,
                    sodium_mg,
                    cholesterol_mg,
                    vitamin_a_mcg,
                    vitamin_c_mg,
                    vitamin_d_mcg,
                    calcium_mg,
                    iron_mg,
                    potassium_mg,
                    logged_date
                ) VALUES (
                    %s, %s, %s, %s, %s, 100, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                )
                RETURNING id
                """,
                (
                    get_user_id(),
                    food_name,
                    meal_type,
                    serving_quantity,
                    serving_unit,
                    calories,
                    protein_g,
                    carbs_g,
                    fat_g,
                    fiber_g,
                    sugar_g,
                    saturated_fat_g,
                    sodium_mg,
                    cholesterol_mg,
                    vitamin_a_mcg,
                    vitamin_c_mg,
                    vitamin_d_mcg,
                    calcium_mg,
                    iron_mg,
                    potassium_mg,
                    today_str,
                ),
            )
            log_id = cur.fetchone()[0]
            conn.commit()

    return {
        "success": True,
        "message": f"Logged {food_name} to {meal_type}",
        "logId": str(log_id),
        "logged": {
            "food": food_name,
            "meal": meal_type,
            "serving": serving_description,
            "calories": calories,
            "protein": protein_g,
            "carbs": carbs_g,
            "fat": fat_g,
        },
    }


# =============================================================================
# TOOL 9: DELETE FOOD LOG
# =============================================================================


@tool
def delete_food_log(log_id: str) -> dict:
    """Delete a food entry from today's log.

    Use get_todays_food_log first to find the ID of the item to delete.

    Args:
        log_id: The ID of the food log entry to delete (from get_todays_food_log)

    Returns:
        Confirmation of deletion or error if not found
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM food_logs
                WHERE id = %s
                    AND user_id = %s
                RETURNING id, food_name
                """,
                (log_id, get_user_id()),
            )
            row = cur.fetchone()
            conn.commit()

    if not row:
        return {"success": False, "message": "Food log not found or already deleted"}

    return {
        "success": True,
        "message": f'Deleted "{row[1]}" from your food log',
        "deletedId": str(row[0]),
    }


# =============================================================================
# TOOL 10: SEARCH FOODS
# =============================================================================


@tool
def search_foods(query: str, limit: int = 10) -> dict:
    """Search the USDA food database for nutritional information.

    Use this before logging food to get accurate nutritional values:
    - "Search for chicken breast"
    - "Find nutritional info for banana"

    Args:
        query: Food name to search for
        limit: Maximum results to return (default 10)

    Returns:
        List of matching foods with nutritional data per 100g
    """
    limit = min(max(limit, 1), 20)
    search_pattern = f"%{query.lower()}%"

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    name,
                    brand,
                    category,
                    serving_size,
                    serving_unit,
                    calories,
                    protein_g,
                    carbs_g,
                    fat_g,
                    fiber_g,
                    sugar_g,
                    saturated_fat_g,
                    sodium_mg,
                    cholesterol_mg,
                    vitamin_a_mcg,
                    vitamin_c_mg,
                    vitamin_d_mcg,
                    calcium_mg,
                    iron_mg,
                    potassium_mg
                FROM foods
                WHERE LOWER(name) LIKE %s
                ORDER BY
                    CASE WHEN LOWER(name) = %s THEN 0
                         WHEN LOWER(name) LIKE %s THEN 1
                         ELSE 2 END,
                    LENGTH(name)
                LIMIT %s
                """,
                (search_pattern, query.lower(), f"{query.lower()}%", limit),
            )
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

    if not rows:
        return {
            "message": "No foods found matching your search. You can still log with estimated values.",
            "foods": [],
        }

    def parse_num(val):
        return round(float(val), 1) if val else None

    return {
        "query": query,
        "count": len(rows),
        "foods": [
            {
                "id": str(dict(zip(columns, row))["id"]),
                "name": dict(zip(columns, row))["name"],
                "brand": dict(zip(columns, row))["brand"],
                "category": dict(zip(columns, row))["category"],
                "servingSize": f"{dict(zip(columns, row))['serving_size']}{dict(zip(columns, row))['serving_unit']}",
                "per100g": {
                    "calories": round(float(dict(zip(columns, row))["calories"] or 0)),
                    "proteinG": parse_num(dict(zip(columns, row))["protein_g"]),
                    "carbsG": parse_num(dict(zip(columns, row))["carbs_g"]),
                    "fatG": parse_num(dict(zip(columns, row))["fat_g"]),
                    "fiberG": parse_num(dict(zip(columns, row))["fiber_g"]),
                    "sugarG": parse_num(dict(zip(columns, row))["sugar_g"]),
                    "saturatedFatG": parse_num(dict(zip(columns, row))["saturated_fat_g"]),
                    "sodiumMg": parse_num(dict(zip(columns, row))["sodium_mg"]),
                    "cholesterolMg": parse_num(dict(zip(columns, row))["cholesterol_mg"]),
                    "vitaminAMcg": parse_num(dict(zip(columns, row))["vitamin_a_mcg"]),
                    "vitaminCMg": parse_num(dict(zip(columns, row))["vitamin_c_mg"]),
                    "vitaminDMcg": parse_num(dict(zip(columns, row))["vitamin_d_mcg"]),
                    "calciumMg": parse_num(dict(zip(columns, row))["calcium_mg"]),
                    "ironMg": parse_num(dict(zip(columns, row))["iron_mg"]),
                    "potassiumMg": parse_num(dict(zip(columns, row))["potassium_mg"]),
                },
            }
            for row in rows
        ],
    }


# =============================================================================
# TOOL 11: GET FOOD PORTIONS
# =============================================================================


@tool
def get_food_portions(food_id: str) -> dict:
    """Get available portion sizes for a food.

    Use this after search_foods to find serving size options:
    - "1 medium apple = 182g"
    - "1 cup = 240ml"

    Args:
        food_id: The food ID from search_foods

    Returns:
        List of portion sizes with gram weights
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT portion_name, gram_weight, is_default
                FROM food_portions
                WHERE food_id = %s
                ORDER BY is_default DESC, gram_weight ASC
                """,
                (food_id,),
            )
            rows = cur.fetchall()

    if not rows:
        return {
            "foodId": food_id,
            "message": "No portion data available. Use gram weight.",
            "portions": [{"name": "100g", "grams": 100}],
        }

    return {
        "foodId": food_id,
        "portions": [
            {
                "name": row[0],
                "grams": round(float(row[1])),
                "isDefault": row[2],
            }
            for row in rows
        ],
    }


# =============================================================================
# TOOL 12: GET BLOOD WORK RESULTS
# =============================================================================


@tool
def get_blood_work_results(limit: int = 5) -> dict:
    """Get recent blood work results with biomarkers grouped by category.

    Use this when the user asks about:
    - "What are my blood work results?"
    - "Show my lab results"
    - "What biomarkers do I have?"

    Args:
        limit: Number of recent tests to fetch (default 5, max 20)

    Returns:
        List of blood work tests with markers grouped by category
    """
    limit = min(max(limit, 1), 20)

    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    test_date,
                    lab_name,
                    markers,
                    created_at
                FROM blood_work
                WHERE user_id = %s
                ORDER BY test_date DESC
                LIMIT %s
                """,
                (get_user_id(), limit),
            )
            rows = cur.fetchall()
            columns = [desc[0] for desc in cur.description]

    if not rows:
        return {
            "message": "No blood work results found. Upload results via the Olympus web app.",
            "results": [],
        }

    results = []
    for row in rows:
        data = dict(zip(columns, row))
        markers = data["markers"] or []

        # Group markers by category
        by_category: dict = {}
        for m in markers:
            cat = m.get("category", "other")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append(m)

        results.append(
            {
                "id": str(data["id"]),
                "testDate": str(data["test_date"]),
                "labName": data["lab_name"],
                "markerCount": len(markers),
                "markers": by_category,
            }
        )

    return {"count": len(results), "results": results}


# =============================================================================
# TOOL 13: GET BLOOD WORK BY ID
# =============================================================================


@tool
def get_blood_work_by_id(result_id: str) -> dict:
    """Get a single blood work result with all its markers.

    Args:
        result_id: The blood work result ID (from get_blood_work_results)

    Returns:
        Complete blood work result with all markers
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                    id,
                    test_date,
                    lab_name,
                    markers,
                    created_at
                FROM blood_work
                WHERE id = %s
                    AND user_id = %s
                LIMIT 1
                """,
                (result_id, get_user_id()),
            )
            row = cur.fetchone()
            columns = [desc[0] for desc in cur.description] if row else []

    if not row:
        return {"error": "Blood work result not found"}

    data = dict(zip(columns, row))
    return {
        "id": str(data["id"]),
        "testDate": str(data["test_date"]),
        "labName": data["lab_name"],
        "markers": data["markers"] or [],
    }


# =============================================================================
# TOOL 14: ADD BLOOD WORK MARKER
# =============================================================================


@tool
def add_blood_work_marker(
    result_id: str,
    name: str,
    value: float,
    unit: str,
    category: str = "other",
    reference_min: Optional[float] = None,
    reference_max: Optional[float] = None,
) -> dict:
    """Add a new biomarker to an existing blood work result.

    Use this when the user wants to add a missing marker:
    - "Add my vitamin D level"
    - "Add cholesterol to my blood work"

    Args:
        result_id: The blood work result ID
        name: Marker name (e.g., "Vitamin D", "Cholesterol")
        value: The numeric value
        unit: Unit of measurement (e.g., "ng/mL", "mg/dL")
        category: Category (metabolic, lipid, blood, liver, kidney, thyroid, vitamins, inflammation, hormones, electrolytes, other)
        reference_min: Lower reference range (optional)
        reference_max: Upper reference range (optional)

    Returns:
        Confirmation of the added marker
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            # Get existing markers
            cur.execute(
                """
                SELECT markers FROM blood_work
                WHERE id = %s AND user_id = %s
                """,
                (result_id, get_user_id()),
            )
            row = cur.fetchone()

            if not row:
                return {"success": False, "error": "Blood work result not found"}

            existing_markers = row[0] or []

            # Check if marker already exists
            for m in existing_markers:
                if m.get("name", "").lower() == name.lower():
                    return {
                        "success": False,
                        "error": f'Marker "{name}" already exists. Use edit_blood_work_marker to update it.',
                    }

            # Add new marker
            new_marker = {"name": name, "value": value, "unit": unit, "category": category}
            if reference_min is not None:
                new_marker["referenceMin"] = reference_min
            if reference_max is not None:
                new_marker["referenceMax"] = reference_max

            new_markers = existing_markers + [new_marker]

            cur.execute(
                """
                UPDATE blood_work
                SET markers = %s::jsonb
                WHERE id = %s
                """,
                (json.dumps(new_markers), result_id),
            )
            conn.commit()

    return {
        "success": True,
        "message": f'Added marker "{name}" with value {value} {unit}',
        "markerCount": len(new_markers),
    }


# =============================================================================
# TOOL 15: EDIT BLOOD WORK MARKER
# =============================================================================


@tool
def edit_blood_work_marker(
    result_id: str,
    marker_name: str,
    value: Optional[float] = None,
    unit: Optional[str] = None,
    new_name: Optional[str] = None,
    reference_min: Optional[float] = None,
    reference_max: Optional[float] = None,
) -> dict:
    """Edit an existing biomarker in a blood work result.

    Args:
        result_id: The blood work result ID
        marker_name: Current name of the marker to edit
        value: New value (optional)
        unit: New unit (optional)
        new_name: Rename the marker (optional)
        reference_min: New lower reference range (optional)
        reference_max: New upper reference range (optional)

    Returns:
        Before and after values of the marker
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT markers FROM blood_work
                WHERE id = %s AND user_id = %s
                """,
                (result_id, get_user_id()),
            )
            row = cur.fetchone()

            if not row:
                return {"success": False, "error": "Blood work result not found"}

            existing_markers = row[0] or []

            # Find the marker to edit
            marker_idx = None
            for idx, m in enumerate(existing_markers):
                if m.get("name", "").lower() == marker_name.lower():
                    marker_idx = idx
                    break

            if marker_idx is None:
                marker_names = [m.get("name", "") for m in existing_markers]
                return {
                    "success": False,
                    "error": f'Marker "{marker_name}" not found. Available: {", ".join(marker_names)}',
                }

            old_marker = existing_markers[marker_idx].copy()
            updated_marker = existing_markers[marker_idx].copy()

            if new_name is not None:
                updated_marker["name"] = new_name
            if value is not None:
                updated_marker["value"] = value
            if unit is not None:
                updated_marker["unit"] = unit
            if reference_min is not None:
                updated_marker["referenceMin"] = reference_min
            if reference_max is not None:
                updated_marker["referenceMax"] = reference_max

            new_markers = existing_markers.copy()
            new_markers[marker_idx] = updated_marker

            cur.execute(
                """
                UPDATE blood_work
                SET markers = %s::jsonb
                WHERE id = %s
                """,
                (json.dumps(new_markers), result_id),
            )
            conn.commit()

    return {
        "success": True,
        "message": f'Updated marker "{marker_name}"',
        "before": old_marker,
        "after": updated_marker,
    }


# =============================================================================
# TOOL 16: DELETE BLOOD WORK MARKER
# =============================================================================


@tool
def delete_blood_work_marker(result_id: str, marker_name: str) -> dict:
    """Delete a biomarker from a blood work result.

    Args:
        result_id: The blood work result ID
        marker_name: Name of the marker to delete

    Returns:
        Confirmation with the deleted marker details
    """
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT markers FROM blood_work
                WHERE id = %s AND user_id = %s
                """,
                (result_id, get_user_id()),
            )
            row = cur.fetchone()

            if not row:
                return {"success": False, "error": "Blood work result not found"}

            existing_markers = row[0] or []

            # Find and remove the marker
            marker_idx = None
            for idx, m in enumerate(existing_markers):
                if m.get("name", "").lower() == marker_name.lower():
                    marker_idx = idx
                    break

            if marker_idx is None:
                marker_names = [m.get("name", "") for m in existing_markers]
                return {
                    "success": False,
                    "error": f'Marker "{marker_name}" not found. Available: {", ".join(marker_names)}',
                }

            deleted_marker = existing_markers[marker_idx]
            new_markers = [m for idx, m in enumerate(existing_markers) if idx != marker_idx]

            cur.execute(
                """
                UPDATE blood_work
                SET markers = %s::jsonb
                WHERE id = %s
                """,
                (json.dumps(new_markers), result_id),
            )
            conn.commit()

    return {
        "success": True,
        "message": f'Deleted marker "{marker_name}"',
        "deleted": deleted_marker,
        "remainingCount": len(new_markers),
    }


# =============================================================================
# TOOL 17: GET LONGEVITY METRICS
# =============================================================================

# PhenoAge coefficients from Levine 2018
PHENO_AGE_COEFFICIENTS = {
    "intercept": -19.9067,
    "albumin": -0.0336,
    "creatinine": 0.0095,
    "glucose": 0.1953,
    "lnCrp": 0.0954,
    "lymphocytePercent": -0.0120,
    "mcv": 0.0268,
    "rdw": 0.3306,
    "alkalinePhosphatase": 0.0019,
    "wbc": 0.0554,
    "age": 0.0804,
}


def _calculate_pheno_age(
    chronological_age: float,
    albumin: Optional[float] = None,
    creatinine: Optional[float] = None,
    glucose: Optional[float] = None,
    crp: Optional[float] = None,
    lymphocyte_percent: Optional[float] = None,
    mcv: Optional[float] = None,
    rdw: Optional[float] = None,
    alkaline_phosphatase: Optional[float] = None,
    wbc: Optional[float] = None,
) -> tuple[Optional[float], list[str]]:
    """Calculate PhenoAge biological age from blood markers."""
    missing_markers = []

    if albumin is None:
        missing_markers.append("Albumin")
    if creatinine is None:
        missing_markers.append("Creatinine")
    if glucose is None:
        missing_markers.append("Fasting Glucose")
    if crp is None:
        missing_markers.append("hs-CRP")
    if lymphocyte_percent is None:
        missing_markers.append("Lymphocyte %")
    if mcv is None:
        missing_markers.append("MCV")
    if rdw is None:
        missing_markers.append("RDW")
    if alkaline_phosphatase is None:
        missing_markers.append("Alkaline Phosphatase")
    if wbc is None:
        missing_markers.append("WBC")

    if missing_markers:
        return None, missing_markers

    # Unit conversions
    albumin_gl = albumin * 10  # type: ignore
    creatinine_umoll = creatinine * 88.4  # type: ignore
    glucose_mmoll = glucose * 0.0555  # type: ignore
    ln_crp = math.log(max(crp, 0.1))  # type: ignore

    # Calculate linear predictor
    xb = (
        PHENO_AGE_COEFFICIENTS["intercept"]
        + PHENO_AGE_COEFFICIENTS["albumin"] * albumin_gl
        + PHENO_AGE_COEFFICIENTS["creatinine"] * creatinine_umoll
        + PHENO_AGE_COEFFICIENTS["glucose"] * glucose_mmoll
        + PHENO_AGE_COEFFICIENTS["lnCrp"] * ln_crp
        + PHENO_AGE_COEFFICIENTS["lymphocytePercent"] * lymphocyte_percent  # type: ignore
        + PHENO_AGE_COEFFICIENTS["mcv"] * mcv  # type: ignore
        + PHENO_AGE_COEFFICIENTS["rdw"] * rdw  # type: ignore
        + PHENO_AGE_COEFFICIENTS["alkalinePhosphatase"] * alkaline_phosphatase  # type: ignore
        + PHENO_AGE_COEFFICIENTS["wbc"] * wbc  # type: ignore
        + PHENO_AGE_COEFFICIENTS["age"] * chronological_age
    )

    gamma = 0.0076927
    mortality_score = 1 - math.exp(-math.exp(xb) * (math.exp(120 * gamma) - 1) / gamma)
    biological_age = 141.50225 + math.log(-0.00553 * math.log(1 - mortality_score)) / 0.090165

    return round(max(20, min(120, biological_age)), 1), []


@tool
def get_longevity_metrics() -> dict:
    """Calculate biological age using PhenoAge algorithm and longevity pillar scores.

    PhenoAge is a validated biological age algorithm that uses 9 blood biomarkers
    to estimate biological age. Use this when the user asks about:
    - "What's my biological age?"
    - "How am I aging?"
    - "Longevity metrics"

    Required blood markers for calculation:
    - Albumin, Creatinine, Fasting Glucose, hs-CRP
    - Lymphocyte %, MCV, RDW, Alkaline Phosphatase, WBC

    Returns:
        Biological age, age difference, pillar scores, and recommendations
    """
    # Get user's date of birth
    with get_connection() as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT date_of_birth FROM users WHERE id = %s",
                (get_user_id(),),
            )
            user_row = cur.fetchone()

            if not user_row or not user_row[0]:
                return {
                    "error": "Please set your date of birth in settings to calculate biological age."
                }

            dob = user_row[0]
            if isinstance(dob, str):
                dob = datetime.fromisoformat(dob)

            today = datetime.now()
            chronological_age = today.year - dob.year
            if (today.month, today.day) < (dob.month, dob.day):
                chronological_age -= 1

            # Get latest blood work
            cur.execute(
                """
                SELECT markers, test_date, lab_name
                FROM blood_work
                WHERE user_id = %s
                ORDER BY test_date DESC
                LIMIT 1
                """,
                (get_user_id(),),
            )
            blood_row = cur.fetchone()

    if not blood_row:
        return {
            "chronologicalAge": chronological_age,
            "biologicalAge": None,
            "message": "No blood work data. Upload blood work results to calculate biological age.",
            "requiredMarkers": [
                "Albumin",
                "Creatinine",
                "Fasting Glucose",
                "hs-CRP",
                "Lymphocyte %",
                "MCV",
                "RDW",
                "Alkaline Phosphatase",
                "WBC",
            ],
        }

    markers = blood_row[0] or []
    test_date = blood_row[1]
    lab_name = blood_row[2]

    # Map markers to PhenoAge input
    marker_mappings = {
        "albumin": "albumin",
        "creatinine": "creatinine",
        "glucose": "glucose",
        "fasting glucose": "glucose",
        "crp": "crp",
        "hs-crp": "crp",
        "lymphocyte": "lymphocyte_percent",
        "lymphocyte %": "lymphocyte_percent",
        "mcv": "mcv",
        "rdw": "rdw",
        "alkaline phosphatase": "alkaline_phosphatase",
        "alp": "alkaline_phosphatase",
        "wbc": "wbc",
    }

    pheno_input: dict = {}
    for marker in markers:
        normalized_name = marker.get("name", "").lower().strip()
        for pattern, field in marker_mappings.items():
            if pattern in normalized_name or normalized_name == pattern:
                pheno_input[field] = marker.get("value")
                break

    biological_age, missing_markers = _calculate_pheno_age(
        chronological_age=chronological_age,
        albumin=pheno_input.get("albumin"),
        creatinine=pheno_input.get("creatinine"),
        glucose=pheno_input.get("glucose"),
        crp=pheno_input.get("crp"),
        lymphocyte_percent=pheno_input.get("lymphocyte_percent"),
        mcv=pheno_input.get("mcv"),
        rdw=pheno_input.get("rdw"),
        alkaline_phosphatase=pheno_input.get("alkaline_phosphatase"),
        wbc=pheno_input.get("wbc"),
    )

    # Calculate pillar scores
    pillars = []

    # Metabolic Health
    if "glucose" in pheno_input and pheno_input["glucose"]:
        glucose = pheno_input["glucose"]
        if glucose < 100:
            score, status = 100, "optimal"
            detail = f"Glucose: {glucose} mg/dL (Optimal)"
        elif glucose < 126:
            score, status = 60, "good"
            detail = f"Glucose: {glucose} mg/dL (Pre-diabetic)"
        else:
            score, status = 20, "needs attention"
            detail = f"Glucose: {glucose} mg/dL (Elevated)"
        pillars.append({"name": "Metabolic Health", "score": score, "status": status, "details": [detail]})

    # Inflammation
    if "crp" in pheno_input and pheno_input["crp"]:
        crp = pheno_input["crp"]
        if crp < 1:
            score, status = 100, "optimal"
            detail = f"hs-CRP: {crp} mg/L (Low risk)"
        elif crp < 3:
            score, status = 70, "good"
            detail = f"hs-CRP: {crp} mg/L (Moderate)"
        else:
            score, status = 30, "needs attention"
            detail = f"hs-CRP: {crp} mg/L (High)"
        pillars.append({"name": "Inflammation", "score": score, "status": status, "details": [detail]})

    # Blood Health
    blood_details = []
    blood_scores = []
    if "rdw" in pheno_input and pheno_input["rdw"]:
        rdw = pheno_input["rdw"]
        if rdw <= 14.5:
            blood_scores.append(100)
            blood_details.append(f"RDW: {rdw}% (Normal)")
        else:
            blood_scores.append(50)
            blood_details.append(f"RDW: {rdw}% (Elevated - linked to aging)")

    if "wbc" in pheno_input and pheno_input["wbc"]:
        wbc = pheno_input["wbc"]
        if 4 <= wbc <= 10:
            blood_scores.append(100)
            blood_details.append(f"WBC: {wbc} K/uL (Normal)")
        else:
            blood_scores.append(50)
            blood_details.append(f"WBC: {wbc} K/uL (Outside normal)")

    if blood_scores:
        avg_score = sum(blood_scores) / len(blood_scores)
        status = "optimal" if avg_score >= 80 else "good" if avg_score >= 60 else "needs attention"
        pillars.append({"name": "Blood Health", "score": round(avg_score), "status": status, "details": blood_details})

    age_difference = biological_age - chronological_age if biological_age else None

    result = {
        "chronologicalAge": chronological_age,
        "biologicalAge": biological_age,
        "ageDifference": round(age_difference, 1) if age_difference else None,
        "agingStatus": (
            "Aging slower than average"
            if age_difference and age_difference < -2
            else "Aging faster than average"
            if age_difference and age_difference > 2
            else "Aging at expected rate"
            if age_difference is not None
            else None
        ),
        "bloodWorkDate": str(test_date) if test_date else None,
        "labName": lab_name,
        "pillars": pillars,
    }

    if missing_markers:
        result["missingMarkers"] = missing_markers

    if biological_age and age_difference and age_difference > 0:
        result["recommendations"] = [
            "Focus on reducing inflammation through diet (omega-3s, colorful vegetables)",
            "Prioritize 7-8 hours of quality sleep",
            "Regular exercise (150+ min/week cardio, 2x strength training)",
            "Manage stress through meditation or breathwork",
        ]

    return result


# =============================================================================
# TOOL LIST
# Export all tools for the agent to use
# =============================================================================

ALL_TOOLS = [
    # Web Search
    search_web,
    # Health Metrics
    get_sleep_summary,
    get_todays_metrics,
    get_hrv_trend,
    get_recent_workouts,
    get_health_summary,
    # User Profile
    get_user_profile,
    # Nutrition
    get_todays_food_log,
    log_food,
    delete_food_log,
    search_foods,
    get_food_portions,
    # Blood Work
    get_blood_work_results,
    get_blood_work_by_id,
    add_blood_work_marker,
    edit_blood_work_marker,
    delete_blood_work_marker,
    # Longevity
    get_longevity_metrics,
]
