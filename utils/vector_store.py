import chromadb
import dashscope
from typing import List, Dict
import os
import hashlib


class VectorStore:
    def __init__(self):
        # Setup qwen embedding
        dashscope.api_key = os.getenv("QWEN_API_KEY")

        # Setup chromadb
        self.client = chromadb.PersistentClient(path="./chroma_db")
        self.collection = self.client.get_or_create_collection(
            name="papers", metadata={"hnsw:space": "cosine"}
        )

    def get_embedding(self, text: str) -> List[float]:
        """Get embedding from qwen"""
        try:
            response = dashscope.TextEmbedding.call(
                model=dashscope.TextEmbedding.Models.text_embedding_v2,
                input=text[:2000],  # Limit text length
            )
            return response.output["embeddings"][0]["embedding"]
        except Exception as e:
            print(f"Embedding error: {e}")
            return []

    def add_document(self, doc_id: str, content: str, metadata: dict = None):
        """Add document to vector store"""
        embedding = self.get_embedding(content)
        if not embedding:
            return False

        self.collection.add(
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata or {}],
            ids=[doc_id],
        )
        return True

    def search(self, query: str, limit: int = 5) -> List[Dict]:
        """Search similar documents"""
        query_embedding = self.get_embedding(query)
        if not query_embedding:
            return []

        results = self.collection.query(
            query_embeddings=[query_embedding], n_results=limit
        )

        # Format results
        hits = []
        if results["documents"][0]:
            for i in range(len(results["documents"][0])):
                hits.append(
                    {
                        "paper_id": results["ids"][0][i],
                        "content": results["documents"][0][i],
                        "similarity": 1
                        - results["distances"][0][i],  # Convert distance to similarity
                        "metadata": results["metadatas"][0][i],
                    }
                )

        return hits


# Global instance
vector_store = VectorStore()
