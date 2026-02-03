"""
Supabase Client
REST API client for Supabase database operations
"""
import os
import logging
from typing import Optional
from dataclasses import dataclass

import requests

logger = logging.getLogger(__name__)

DEFAULT_SUPABASE_URL = "https://sisymqzxvuktdcbsbpbp.supabase.co"


@dataclass
class SupabaseConfig:
    """Supabase connection configuration"""
    url: str
    service_key: str
    anon_key: Optional[str] = None


class SupabaseClient:
    """Supabase REST API client for SISU data"""

    def __init__(self, url: Optional[str] = None, service_key: Optional[str] = None):
        self.url = url or os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL)
        self.service_key = service_key or os.environ.get("SUPABASE_SERVICE_KEY", "")

        if not self.service_key:
            raise ValueError("SUPABASE_SERVICE_KEY is required")

        self.headers = {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
        }

    def _request(self, method: str, endpoint: str, **kwargs) -> requests.Response:
        """Make HTTP request to Supabase"""
        url = f"{self.url}/rest/v1/{endpoint}"
        headers = {**self.headers, **kwargs.pop("headers", {})}
        resp = requests.request(method, url, headers=headers, **kwargs)
        return resp

    def _get(self, endpoint: str, params: Optional[dict] = None) -> list[dict]:
        """GET request returning JSON list"""
        resp = self._request("GET", endpoint, params=params)
        resp.raise_for_status()
        return resp.json()

    def _post(self, endpoint: str, data: dict) -> dict:
        """POST request returning created record"""
        resp = self._request(
            "POST", endpoint,
            json=data,
            headers={"Prefer": "return=representation"}
        )
        resp.raise_for_status()
        result = resp.json()
        return result[0] if result else {}

    def _upsert(self, endpoint: str, data: dict, on_conflict: str = "") -> dict:
        """UPSERT (insert or update) request"""
        headers = {"Prefer": "return=representation"}
        if on_conflict:
            headers["Prefer"] += f",resolution=merge-duplicates"

        resp = self._request(
            "POST", endpoint,
            json=data,
            headers=headers,
            params={"on_conflict": on_conflict} if on_conflict else None
        )
        resp.raise_for_status()
        result = resp.json()
        return result[0] if result else {}

    # Course operations
    def get_course_by_code(self, code: int) -> Optional[dict]:
        """Get course by SISU code"""
        results = self._get("courses", params={"code": f"eq.{code}"})
        return results[0] if results else None

    def upsert_course(self, course_data: dict) -> dict:
        """Insert or update a course"""
        existing = self.get_course_by_code(course_data["code"])
        if existing:
            # Update
            resp = self._request(
                "PATCH",
                f"courses?code=eq.{course_data['code']}",
                json=course_data,
                headers={"Prefer": "return=representation"}
            )
            resp.raise_for_status()
            return resp.json()[0]
        else:
            # Insert
            return self._post("courses", course_data)

    def search_courses(self, query: str, limit: int = 20) -> list[dict]:
        """Search courses by name, university, or city"""
        # Use ilike for case-insensitive search
        return self._get(
            "courses",
            params={
                "or": f"(name.ilike.%{query}%,university.ilike.%{query}%,city.ilike.%{query}%)",
                "limit": limit
            }
        )

    def get_courses_by_state(self, state: str) -> list[dict]:
        """Get all courses in a state"""
        return self._get("courses", params={"state": f"eq.{state.upper()}"})

    # Weights operations
    def upsert_weights(self, course_id: int, year: int, weights: dict, minimums: dict) -> dict:
        """Insert or update course weights for a year"""
        data = {
            "course_id": course_id,
            "year": year,
            "peso_red": weights.get("pesoRed"),
            "peso_ling": weights.get("pesoLing"),
            "peso_mat": weights.get("pesoMat"),
            "peso_ch": weights.get("pesoCh"),
            "peso_cn": weights.get("pesoCn"),
            "min_red": minimums.get("minRed"),
            "min_ling": minimums.get("minLing"),
            "min_mat": minimums.get("minMat"),
            "min_ch": minimums.get("minCh"),
            "min_cn": minimums.get("minCn"),
            "min_enem": minimums.get("minEnem"),
        }

        # Check if exists
        existing = self._get(
            "course_weights",
            params={"course_id": f"eq.{course_id}", "year": f"eq.{year}"}
        )

        if existing:
            resp = self._request(
                "PATCH",
                f"course_weights?course_id=eq.{course_id}&year=eq.{year}",
                json=data,
                headers={"Prefer": "return=representation"}
            )
            resp.raise_for_status()
            return resp.json()[0]
        else:
            return self._post("course_weights", data)

    def get_weights(self, course_id: int, year: int) -> Optional[dict]:
        """Get weights for a course/year"""
        results = self._get(
            "course_weights",
            params={"course_id": f"eq.{course_id}", "year": f"eq.{year}"}
        )
        return results[0] if results else None

    # Cut scores operations
    def insert_cut_score(self, course_id: int, year: int, modality: dict) -> dict:
        """Insert a cut score record"""
        data = {
            "course_id": course_id,
            "year": year,
            "modality_code": modality.get("code"),
            "modality_name": modality.get("name"),
            "cut_score": modality.get("cut_score"),
            "applicants": modality.get("applicants"),
            "vacancies": modality.get("vacancies"),
        }
        return self._post("cut_scores", data)

    def get_latest_cut_scores(self, course_id: int, year: int) -> list[dict]:
        """Get latest cut scores for a course/year"""
        return self._get(
            "cut_scores",
            params={
                "course_id": f"eq.{course_id}",
                "year": f"eq.{year}",
                "order": "modality_code,captured_at.desc"
            }
        )

    def get_cut_score_history(self, course_id: int, modality_code: int, limit: int = 100) -> list[dict]:
        """Get historical cut scores for a modality"""
        return self._get(
            "cut_scores",
            params={
                "course_id": f"eq.{course_id}",
                "modality_code": f"eq.{modality_code}",
                "order": "captured_at.desc",
                "limit": limit
            }
        )

    # Bulk operations
    def save_course_data(self, course_code: int, data: dict) -> int:
        """Save complete course data from JSON to database"""
        course_data = {
            "code": course_code,
            "name": data.get("course_name", ""),
            "university": data.get("university"),
            "campus": data.get("campus"),
            "city": data.get("city"),
            "state": data.get("state"),
            "degree": data.get("degree"),
            "schedule": data.get("schedule"),
            "latitude": data.get("latitude"),
            "longitude": data.get("longitude"),
        }

        course = self.upsert_course(course_data)
        course_id = course["id"]
        logger.info(f"Saved course {course_code} -> id {course_id}")

        for year_data in data.get("years", []):
            year = year_data.get("year")
            if not year:
                continue

            weights = year_data.get("weights", {})
            minimums = year_data.get("minimums", {})
            if weights or minimums:
                self.upsert_weights(course_id, year, weights, minimums)

            for modality in year_data.get("modalities", []):
                self.insert_cut_score(course_id, year, modality)

        return course_id

    def test_connection(self) -> bool:
        """Test database connection"""
        try:
            self._get("courses", params={"limit": 1})
            return True
        except Exception as e:
            logger.error(f"Connection test failed: {e}")
            return False
