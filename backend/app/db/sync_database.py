from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


SYNC_DATABASE_URL = settings.DATABASE_URL.replace(
    "postgresql+asyncpg://",
    "postgresql+psycopg://",
)

engine = create_engine(
    SYNC_DATABASE_URL,
    echo=False,
)

SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
)