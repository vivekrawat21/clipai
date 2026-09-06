from sentence_transformers import util

from app.services.embeddings import embedding_service


sentence_a = (
    "I lost my company and learned "
    "an important lesson from that failure."
)

sentence_b = (
    "My business failed, but the experience "
    "taught me something valuable."
)

sentence_c = (
    "The weather is very cold today."
)


embedding_a = (
    embedding_service.generate_embedding(
        sentence_a
    )
)

embedding_b = (
    embedding_service.generate_embedding(
        sentence_b
    )
)

embedding_c = (
    embedding_service.generate_embedding(
        sentence_c
    )
)


print(
    "Embedding dimensions:",
    len(embedding_a),
)


similarity_ab = util.cos_sim(
    embedding_a,
    embedding_b,
).item()


similarity_ac = util.cos_sim(
    embedding_a,
    embedding_c,
).item()


print(
    "A ↔ B similarity:",
    round(similarity_ab, 4),
)

print(
    "A ↔ C similarity:",
    round(similarity_ac, 4),
)