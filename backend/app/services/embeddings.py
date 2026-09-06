import logging

from sentence_transformers import SentenceTransformer


logger = logging.getLogger(__name__)


MODEL_NAME = "all-MiniLM-L6-v2"


class EmbeddingService:
    """
    Service responsible for generating semantic text embeddings.
    """

    def __init__(self):
        logger.info(
            "Loading embedding model: %s",
            MODEL_NAME,
        )

        self.model = SentenceTransformer(
            MODEL_NAME,
            device="cpu",
        )

        logger.info(
            "Embedding model loaded successfully: %s",
            MODEL_NAME,
        )

    def generate_embedding(
        self,
        text: str,
    ) -> list[float]:
        """
        Generate an embedding for a single text.

        Returns:
            384-dimensional embedding.
        """

        if not text or not text.strip():
            raise ValueError(
                "Text cannot be empty"
            )

        embedding = self.model.encode(
            text,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )

        return embedding.tolist()

    def generate_embeddings(
        self,
        texts: list[str],
    ) -> list[list[float]]:
        """
        Generate embeddings for multiple texts.

        Embeddings are generated in batches for better
        performance when processing many transcript segments.
        """

        if not texts:
            return []

        cleaned_texts = [
            text.strip()
            for text in texts
        ]

        if any(not text for text in cleaned_texts):
            raise ValueError(
                "Transcript contains empty texts"
            )

        embeddings = self.model.encode(
            cleaned_texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
            batch_size=32,
            show_progress_bar=False,
        )

        return embeddings.tolist()


embedding_service = EmbeddingService()