import json
from typing import Optional, Dict, Any, List
from motor.motor_asyncio import AsyncIOMotorClient
from meilisearch import Client
from .config import MONGODB, MEILISEARCH, API
from .async_meilisearch import AsyncMeilisearchClient
from .vector_store import vector_store

# MongoDB connection URI
mongo_uri = f"mongodb://{MONGODB['username']}:{MONGODB['password']}@{MONGODB['host']}:{MONGODB['port']}/?authSource={MONGODB['auth_db']}"

# MongoDB client
mongo_client = AsyncIOMotorClient(mongo_uri)

# Database collections
db = mongo_client["userDB"]
users_collection = db["users"]
solutions_collection = db["solutions"]
papers_db = mongo_client["papersDB"]
papers_collection = papers_db["papersCollection"]

# Relationship collections
solutions_liked_collection = db["solution_liked"]
papers_cited_collection = db["paper_cited"]
papers_liked_collection = db["paper_liked"]

# API configuration constants
ALLOWED_USER_TYPES = API["allowed_user_types"]
SECRET_KEY = API["secret_key"]

# Meilisearch clients
meili_client = Client(MEILISEARCH["host"])
async_meili_client = AsyncMeilisearchClient(MEILISEARCH["host"], MEILISEARCH["api_key"])


# Meilisearch index functions
def get_paper_index():
    return meili_client.index("paper_id")


def get_solution_index():
    return meili_client.index("solution_id")


def get_user_index():
    return meili_client.index("user_id")


# Async index functions
async def get_async_paper_index():
    return async_meili_client.index("paper_id")


async def get_async_solution_index():
    return async_meili_client.index("solution_id")


async def get_async_user_index():
    return async_meili_client.index("user_id")


def process_search_results(search_results, max_results=5):
    """Process and deduplicate search results"""
    hits = search_results.get("hits", [])
    if not hits:
        return []

    processed_hits = []
    seen_ids = set()

    for hit in hits:
        doc_id = hit.get("_id")
        if not doc_id or doc_id in seen_ids:
            continue
        seen_ids.add(doc_id)
        scaled_score = hit.get("_rankingScore", 0) * 100
        hit["final_score"] = scaled_score
        hit["keyword_score"] = scaled_score
        hit["vector_score"] = 0
        hit["source"] = "keyword"
        processed_hits.append(hit)

    # Use meilisearch ranking score if available
    processed_hits.sort(key=lambda x: x.get("_rankingScore", 0), reverse=True)
    return processed_hits[:max_results]


def naive_search(query, requirements):
    try:
        search_query = " ".join(requirements[:4])
        index = meili_client.index("paper_id")
        search_results = index.search(
            search_query,
            {
                "limit": 20,
                "attributesToHighlight": ["*"],
                "showRankingScore": True,
                "showRankingScoreDetails": True,
            },
        )
        return process_search_results(search_results, max_results=10)
    except Exception as e:
        print(f"Search error: {str(e)}")
        return {"hits": []}


def search_in_meilisearch(query, requirements):
    try:
        search_terms = []
        import re

        query_words = [
            word for word in re.findall(r"\w+", query.lower()) if len(word) > 2
        ]
        search_terms.extend(query_words[:5])
        if requirements:
            req_words = (
                requirements[:3]
                if isinstance(requirements, list)
                else requirements.split()[:3]
            )
            search_terms.extend(req_words)
        print(search_terms)
        search_query = " ".join(search_terms)
    except Exception as e:
        print(f"Search error: {str(e)}")
        search_query = " ".join(requirements[:4]) if requirements else ""

    try:
        # search_query = " ".join(requirements[:4]) if requirements else ""
        index = meili_client.index("paper_id")
        search_results = index.search(
            search_query,
            {
                "limit": 20,
                "attributesToHighlight": ["*"],
                "showRankingScore": True,
                "showRankingScoreDetails": True,
            },
        )
        search_results = process_search_results(search_results, max_results=10)
        return search_results
    except Exception as e:
        print(f"Search error: {str(e)}")
        return {"hits": []}


async def hybrid_search(
    query: str, requirements: List[str] = None, limit: int = 10
) -> List[Dict]:
    try:
        keyword_results = search_in_meilisearch(query, requirements or [])
        vector_results = vector_store.search(query, limit=limit * 2)

        # Combine and deduplicate
        combined_results = {}

        # Process keyword results
        for hit in keyword_results:
            doc_id = hit.get("_id") or hit.get("paper_id")
            if doc_id:
                combined_results[doc_id] = {
                    **hit,
                    "keyword_score": hit.get("_rankingScore", 0) * 100,
                    "vector_score": 0,
                    "source": "keyword",
                }

        # Process vector results
        for hit in vector_results:
            doc_id = hit.get("paper_id")
            if doc_id:
                if doc_id in combined_results:
                    # Document found by both methods - boost score
                    combined_results[doc_id]["vector_score"] = (
                        hit.get("similarity", 0) * 100
                    )
                    combined_results[doc_id]["source"] = "both"
                    combined_results[doc_id]["vector_metadata"] = hit.get(
                        "metadata", {}
                    )
                else:
                    # Vector-only result - fetch from sync MongoDB
                    try:
                        from bson import ObjectId

                        # Use sync collection to avoid async/coroutine issues
                        paper_doc = await papers_collection.find_one(
                            {"_id": ObjectId(doc_id)}
                        )

                        if paper_doc and isinstance(paper_doc, dict):
                            combined_results[doc_id] = {
                                "_id": doc_id,
                                **convert_objectid_to_str(paper_doc),
                                "keyword_score": 0,
                                "vector_score": hit.get("similarity", 0) * 100,
                                "source": "vector",
                                "vector_content": hit.get("content", ""),
                                "vector_metadata": hit.get("metadata", {}),
                            }
                        else:
                            # Fallback: use minimal vector data if doc fetch fails
                            combined_results[doc_id] = {
                                "_id": doc_id,
                                "paper_id": doc_id,
                                "content": hit.get("content", ""),
                                "metadata": hit.get("metadata", {}),
                                "keyword_score": 0,
                                "vector_score": hit.get("similarity", 0) * 100,
                                "source": "vector",
                            }
                    except Exception as e:
                        print(f"Error fetching paper {doc_id}: {e}")
                        # Fallback: use minimal vector data
                        combined_results[doc_id] = {
                            "_id": doc_id,
                            "paper_id": doc_id,
                            "content": hit.get("content", ""),
                            "metadata": hit.get("metadata", {}),
                            "keyword_score": 0,
                            "vector_score": hit.get("similarity", 0) * 100,
                            "source": "vector",
                        }

        # Calculate final scores and sort
        final_results = []
        for doc_id, result in combined_results.items():
            # Combine scores with weights
            vector_score = result.get("vector_score", 0)
            keyword_score = result.get("keyword_score", 0)

            # Normalize keyword scores
            if keyword_score > 0:
                keyword_score = min(keyword_score / 10, 100)

            # Weight: 70% vector, 30% keyword
            result["final_score"] = vector_score * 0.7 + keyword_score * 0.3
            final_results.append(result)

        # Sort by final score
        final_results.sort(key=lambda x: x.get("final_score", 0), reverse=True)

        return final_results[:limit]

    except Exception as e:
        print(f"Hybrid search error: {e}")
        # Fallback to keyword search only
        try:
            return keyword_results[:limit] if "keyword_results" in locals() else []
        except:
            return []


# Async search functions
async def async_search_in_meilisearch(query, requirements):
    try:
        search_query = " ".join(requirements[:4])
        index = async_meili_client.index("paper_id")
        search_results = await index.search(search_query)
        return search_results
    except Exception as e:
        print(f"Async search error: {str(e)}")
        return {"hits": []}


# Utility functions moved from tasks/config.py
def convert_objectid_to_str(data):
    """Convert MongoDB ObjectId to string recursively"""
    if isinstance(data, dict):
        return {key: convert_objectid_to_str(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [convert_objectid_to_str(element) for element in data]
    elif not isinstance(data, str):
        return str(data)
    else:
        return data


def solution_eval(solution: Any) -> Optional[Dict[str, Any]]:
    """
    Parse and validate solution data

    Args:
        solution: Solution data to parse, can be string or dict

    Returns:
        Dict[str, Any]: Parsed solution dictionary
        None: If parsing fails
    """
    if isinstance(solution, str):
        try:
            # Try JSON parsing
            return json.loads(solution)
        except json.JSONDecodeError:
            try:
                # Try Python eval parsing
                result = eval(solution)
                if isinstance(result, dict):
                    return result
                return None
            except Exception as e:
                print(f"Parse failed: {e}")
                return None
    elif isinstance(solution, dict):
        return solution
    else:
        print(f"Solution type not supported: {type(solution)}")
        return None
