import logging

from sentence_transformers import SentenceTransformer


logger = logging.getLogger(__name__)


MODEL_NAME = "all-MiniLM-L6-v2"


class EmbeddingService:
    """
    Service responsible for generating semantic text embeddings.

    The model is loaded lazily on first use so that importing this module
    (e.g. at Celery worker startup) does not occupy several hundred MB of
    RAM in the idle main process. Each prefork child loads its own copy only
    when it actually runs an embedding step.
    """

    def __init__(self):
        self._model = None

    @property
    def model(self) -> SentenceTransformer:
        if self._model is None:
            logger.info(
                "Loading embedding model: %s",
                MODEL_NAME,
            )

            self._model = SentenceTransformer(
                MODEL_NAME,
                device="cpu",
            )

            logger.info(
                "Embedding model loaded successfully: %s",
                MODEL_NAME,
            )

        return self._model

    def release(self) -> None:
        """Drop the cached model so its memory can be reclaimed.

        Safe to call after the embedding step completes; the model is
        lazily reloaded on the next use.
        """
        if self._model is not None:
            logger.info("Releasing embedding model: %s", MODEL_NAME)
            self._model = None

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