"""
populate_rag.py — Build and persist the Eco Forecast FAISS knowledge-base index.

Run from the backend/ directory:

    python services/populate_rag.py

The script will:
  1. Instantiate RAGEngine (loads the sentence-transformers embedder).
  2. Call create_knowledge_base() to generate the domain document corpus.
  3. Call build_index(docs) to embed all documents and write:
       rag_index/faiss.index
       rag_index/docstore.pkl
  4. Print a summary line confirming the number of indexed documents.

No command-line arguments are required.  Re-running the script will
overwrite any existing index files.
"""

import logging
import os
import sys

# Ensure the backend root is on the path so the relative imports work
# when invoked as `python services/populate_rag.py` from backend/
_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _BACKEND_DIR not in sys.path:
    sys.path.insert(0, _BACKEND_DIR)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("populate_rag")


def main() -> None:
    from services.rag_engine import RAGEngine  # noqa: PLC0415

    logger.info("Initialising RAGEngine …")
    rag = RAGEngine(
        index_path=os.path.join(_BACKEND_DIR, "rag_index"),
        docs_path=os.path.join(_BACKEND_DIR, "rag_docs"),
    )

    if rag.embedder is None:
        logger.error(
            "sentence-transformers is not available. "
            "Install it with: pip install sentence-transformers"
        )
        sys.exit(1)

    logger.info("Building knowledge base …")
    docs = rag.create_knowledge_base()
    logger.info("Created %d documents.", len(docs))

    logger.info("Embedding documents and building FAISS index …")
    count = rag.build_index(docs)

    if count == 0:
        logger.error("Index build failed — 0 documents indexed. Check logs above.")
        sys.exit(1)

    print(f"Indexed {count} documents into FAISS")
    logger.info(
        "Index saved to '%s/faiss.index' and '%s/docstore.pkl'.",
        rag.index_path,
        rag.index_path,
    )

    # Quick sanity check
    results = rag.retrieve("What is the peak demand hour in Lahore?", top_k=2)
    if results:
        logger.info(
            "Retrieval smoke-test passed — top result source: '%s' (score=%.4f)",
            results[0]["source"],
            results[0]["score"],
        )
    else:
        logger.warning("Retrieval smoke-test returned no results — check index integrity.")


if __name__ == "__main__":
    main()
