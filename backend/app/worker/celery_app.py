from celery import Celery

from app.core.config import settings


celery_app = Celery(
    "clip_ai",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
)

celery_app.autodiscover_tasks([
    "app.worker.tasks",
    "app.worker.publishing_tasks",
])

# ─────────────────────────────────────────────────────────────────────
# Tuning for a small / shared development box (the prefork pool defaults
# to one worker per CPU core, and every child loads the full Whisper +
# sentence-transformer + ffmpeg stack → OOM kills mid-task).
#
# Use `--concurrency=1` (or `-P solo`) on the CLI as well.
# ─────────────────────────────────────────────────────────────────────

celery_app.conf.update(
    worker_concurrency=1,
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=1,
    worker_send_task_events=True,
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    task_soft_time_limit=3600,
    task_time_limit=3900,
)