import asyncio
import sys
import os
import re

project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, project_root)
from utils.db import mongo_client, papers_collection
from utils.vector_store import vector_store


def extract_paper_content(paper):
    """Extract valuable text content from paper for vectorization"""
    content_parts = []

    # Extract title
    if "Title" in paper:
        content_parts.append(paper["Title"])

    # Handle papers with text_analysis structure
    if "text_analysis" in paper:
        analysis = paper["text_analysis"]

        # Extract design goals
        if "Design Goal" in analysis:
            goal = analysis["Design Goal"]
            if isinstance(goal, dict):
                if "Tasks" in goal:
                    content_parts.append(str(goal["Tasks"]))
                if "Motivation" in goal:
                    content_parts.append(str(goal["Motivation"]))
            else:
                content_parts.append(str(goal))

        # Extract background problems
        if "Design Background" in analysis:
            bg = analysis["Design Background"]
            if isinstance(bg, dict) and "Existing Problem" in bg:
                content_parts.append(str(bg["Existing Problem"]))

        # Extract results
        if "Results" in analysis:
            results = analysis["Results"]
            if isinstance(results, dict):
                for key, value in results.items():
                    content_parts.append(str(value))
            else:
                content_parts.append(str(results))

    # Handle papers with structured fields
    else:
        # Extract target definition
        if "Target Definition" in paper:
            target = paper["Target Definition"]
            if isinstance(target, dict):
                for key, value in target.items():
                    content_parts.append(str(value))
            else:
                content_parts.append(str(target))

        # Extract innovations
        if "Second Extraction" in paper:
            extraction = paper["Second Extraction"]
            if "Innovations" in extraction:
                content_parts.append(str(extraction["Innovations"]))

        # Extract results
        if "Results" in paper:
            results = paper["Results"]
            if isinstance(results, dict):
                for key, value in results.items():
                    content_parts.append(str(value))
            else:
                content_parts.append(str(results))

    # Join and clean content
    content = " ".join(content_parts)

    # Remove HTML tags and extra formatting
    content = re.sub(r"<[^>]+>", "", content)
    content = re.sub(r"\s+", " ", content)
    content = re.sub(r'["\']', "", content)

    return content.strip()[:2000]  # Limit to 2000 chars


async def setup_vector_db():
    """Populate vector database with papers from MongoDB"""
    print("Starting vector database setup...")

    try:
        # Get total count
        total_papers = await papers_collection.count_documents({})
        print(f"Found {total_papers} papers to process")

        count = 0
        failed = 0

        # Process each paper
        async for paper in papers_collection.find({}):
            try:
                doc_id = str(paper.get("_id"))

                # Extract clean content for vectorization
                content = extract_paper_content(paper)

                # Skip if no meaningful content
                if len(content.strip()) < 50:
                    failed += 1
                    continue

                # Create metadata
                metadata = {
                    "title": str(paper.get("title", paper.get("Title", "")))[:200],
                    "series": str(paper.get("Series", paper.get("series", "")))[:100],
                    "cited": str(paper.get("Cited", "0")),
                }

                # Add to vector store
                if vector_store.add_document(doc_id, content, metadata):
                    count += 1
                else:
                    failed += 1

                # Show progress every 100 papers
                if (count + failed) % 100 == 0:
                    progress = (count + failed) / total_papers * 100
                    print(
                        f"Progress: {progress:.1f}% ({count} success, {failed} failed)"
                    )

            except Exception as e:
                failed += 1
                print(f"Error processing paper: {e}")

        print(f"\nSetup complete!")
        print(f"Successfully added: {count} papers")
        print(f"Failed: {failed} papers")

    except Exception as e:
        print(f"Setup failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(setup_vector_db())
