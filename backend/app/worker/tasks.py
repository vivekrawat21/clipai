import logging
from datetime import datetime
from pathlib import Path

from app.db.sync_database import SessionLocal
from app.models.clip import Clip
from app.models.clip_candidate import ClipCandidate
from app.models.processing_job import ProcessingJob
from app.models.transcript_segment import TranscriptSegment
from app.models.video import Video
from app.services.audio import extract_audio
from app.services.clip_detection import detect_clip_candidates
from app.services.clip_generator import generate_clip
from app.services.embeddings import embedding_service
from app.services.wisper_transcription import transcribe_audio
from app.services.youtube_downloader import download_video
from app.services.youtube_transcription import get_youtube_transcript
from app.worker.celery_app import celery_app


logger = logging.getLogger(__name__)


@celery_app.task
def test_task(name: str):
    logger.info(
        "Processing test task for name=%s",
        name,
    )

    return {
        "message": f"Hello {name}",
    }


@celery_app.task
def process_video(video_id: int, job_id: int):
    logger.info(
        "Starting video processing: "
        "video_id=%s job_id=%s",
        video_id,
        job_id,
    )

    db = SessionLocal()

    try:
        # =================================
        # 1. Get video and processing job
        # =================================

        video = db.get(
            Video,
            video_id,
        )

        job = db.get(
            ProcessingJob,
            job_id,
        )

        if video is None:
            raise ValueError(
                f"Video not found: video_id={video_id}"
            )

        if job is None:
            raise ValueError(
                f"Processing job not found: job_id={job_id}"
            )

        # =================================
        # 2. Start processing
        # =================================

        video.status = "processing"

        job.status = "processing"
        job.progress = 5
        job.started_at = datetime.utcnow()

        db.commit()

        # =================================
        # 3. Try YouTube transcript first
        # =================================

        logger.info(
            "Trying YouTube transcript: "
            "video_id=%s youtube_id=%s",
            video_id,
            video.youtube_id,
        )

        transcript = get_youtube_transcript(
            video.youtube_id
        )

        transcript_source = "youtube"

        # =================================
        # 4. YouTube transcript found
        # =================================

        if transcript:

            logger.info(
                "YouTube transcript found: "
                "video_id=%s segments=%s",
                video_id,
                len(transcript),
            )

            job.progress = 50

            db.commit()

        # =================================
        # 5. YouTube transcript unavailable
        #    Download → Audio → Whisper
        # =================================

        else:

            transcript_source = "whisper"

            logger.info(
                "YouTube transcript unavailable. "
                "Falling back to Whisper: "
                "video_id=%s",
                video_id,
            )

            # ---------------------------------
            # Create storage directory
            # ---------------------------------

            output_dir = (
                Path("storage")
                / "videos"
                / str(video.id)
            )

            output_dir.mkdir(
                parents=True,
                exist_ok=True,
            )

            # ---------------------------------
            # Download video
            # ---------------------------------

            logger.info(
                "Downloading YouTube video: "
                "video_id=%s",
                video_id,
            )

            video_path = download_video(
                str(video.youtube_url),
                output_dir,
            )

            logger.info(
                "Video downloaded: "
                "video_id=%s path=%s",
                video_id,
                video_path,
            )

            video.source_path = str(
                video_path
            )

            job.progress = 30

            db.commit()

            # ---------------------------------
            # Extract audio
            # ---------------------------------

            logger.info(
                "Extracting audio: "
                "video_id=%s",
                video_id,
            )

            audio_path = (
                output_dir / "audio.wav"
            )

            audio_path = extract_audio(
                video_path,
                audio_path,
            )

            video.audio_path = str(
                audio_path
            )

            job.progress = 45

            db.commit()

            logger.info(
                "Audio extraction completed: "
                "video_id=%s path=%s",
                video_id,
                audio_path,
            )

            # ---------------------------------
            # Whisper transcription
            # ---------------------------------

            logger.info(
                "Starting Whisper transcription: "
                "video_id=%s",
                video_id,
            )

            transcript = transcribe_audio(
                audio_path
            )

            if not transcript:

                raise ValueError(
                    "Transcription returned no "
                    f"segments: video_id={video_id}"
                )

            job.progress = 65

            db.commit()

            logger.info(
                "Whisper transcription completed: "
                "video_id=%s segments=%s",
                video_id,
                len(transcript),
            )

        # =================================
        # 6. Save transcript segments
        # =================================

        logger.info(
            "Saving transcript segments: "
            "video_id=%s source=%s segments=%s",
            video_id,
            transcript_source,
            len(transcript),
        )

        for segment in transcript:

            db.add(
                TranscriptSegment(
                    video_id=video.id,
                    start_time=segment["start"],
                    end_time=segment["end"],
                    text=segment["text"],
                )
            )

        db.commit()

        job.progress = 70

        db.commit()

        logger.info(
            "Transcript segments saved: "
            "video_id=%s segments=%s",
            video_id,
            len(transcript),
        )

        # =================================
        # 7. Generate transcript embeddings
        # =================================

        logger.info(
            "Generating transcript embeddings: "
            "video_id=%s",
            video_id,
        )

        segments = (
            db.query(TranscriptSegment)
            .filter(
                TranscriptSegment.video_id == video.id
            )
            .order_by(
                TranscriptSegment.start_time
            )
            .all()
        )

        texts = [
            segment.text
            for segment in segments
        ]

        embeddings = (
            embedding_service.generate_embeddings(
                texts
            )
        )

        if len(embeddings) != len(segments):

            raise ValueError(
                "Embedding count does not match "
                "transcript segment count"
            )

        for segment, embedding in zip(
            segments,
            embeddings,
        ):
            segment.embedding = embedding

        db.commit()

        job.progress = 75

        db.commit()

        logger.info(
            "Transcript embeddings saved: "
            "video_id=%s embeddings=%s",
            video_id,
            len(embeddings),
        )

        # =================================
        # 8. Detect clip candidates
        # =================================

        logger.info(
            "Starting clip candidate detection: "
            "video_id=%s",
            video_id,
        )

        segments = (
            db.query(TranscriptSegment)
            .filter(
                TranscriptSegment.video_id == video.id
            )
            .order_by(
                TranscriptSegment.start_time
            )
            .all()
        )

        logger.info(
            "Loaded transcript segments: "
            "video_id=%s segments=%s",
            video_id,
            len(segments),
        )

        candidates = detect_clip_candidates(
            segments
        )

        logger.info(
            "Clip candidates generated: "
            "video_id=%s candidates=%s",
            video_id,
            len(candidates),
        )

        if not candidates:

            raise ValueError(
                f"No clip candidates found: "
                f"video_id={video_id}"
            )

        # =================================
        # 9. Save ClipCandidate records
        # =================================

        saved_candidates = []

        for candidate in candidates:

            clip_candidate = ClipCandidate(
                video_id=video.id,
                start_time=candidate["start_time"],
                end_time=candidate["end_time"],
                score=candidate["score"],
                reason=candidate["reason"],
            )

            db.add(
                clip_candidate
            )

            # Generate candidate ID
            db.flush()

            saved_candidates.append(
                clip_candidate
            )

        job.progress = 80

        db.commit()

        logger.info(
            "Clip candidates saved: "
            "video_id=%s candidates=%s",
            video_id,
            len(saved_candidates),
        )

        # =================================
        # 10. Make sure source video exists
        # =================================

        output_dir = (
            Path("storage")
            / "videos"
            / str(video.id)
        )

        output_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        if video.source_path:

            source_path = Path(
                video.source_path
            )

            if not source_path.exists():

                logger.warning(
                    "Stored source video does not exist. "
                    "Downloading again: video_id=%s",
                    video_id,
                )

                source_path = download_video(
                    str(video.youtube_url),
                    output_dir,
                )

                video.source_path = str(
                    source_path
                )

                db.commit()

        else:

            logger.info(
                "Source video not available. "
                "Downloading for clip generation: "
                "video_id=%s",
                video_id,
            )

            source_path = download_video(
                str(video.youtube_url),
                output_dir,
            )

            video.source_path = str(
                source_path
            )

            db.commit()

        logger.info(
            "Source video ready: "
            "video_id=%s path=%s",
            video_id,
            source_path,
        )

        # =================================
        # 11. Generate actual clips
        # =================================

        clips_dir = (
            output_dir / "clips"
        )

        clips_dir.mkdir(
            parents=True,
            exist_ok=True,
        )

        logger.info(
            "Starting clip generation: "
            "video_id=%s candidates=%s",
            video_id,
            len(saved_candidates),
        )

        generated_clips = []

        total_candidates = len(
            saved_candidates
        )

        for index, candidate in enumerate(
            saved_candidates,
            start=1,
        ):

            output_path = (
                clips_dir
                / f"clip_{index:03d}.mp4"
            )

            logger.info(
                "Generating clip %s/%s: "
                "video_id=%s start=%.2f end=%.2f",
                index,
                total_candidates,
                video_id,
                candidate.start_time,
                candidate.end_time,
            )

            generated_path = generate_clip(
                source_path=source_path,
                output_path=output_path,
                start_time=candidate.start_time,
                end_time=candidate.end_time,
            )

            duration = (
                candidate.end_time
                - candidate.start_time
            )

            clip = Clip(
                video_id=video.id,
                candidate_id=candidate.id,
                start_time=candidate.start_time,
                end_time=candidate.end_time,
                score=candidate.score,
                file_path=str(
                    generated_path
                ),
                duration=duration,
                status="generated",
            )

            db.add(clip)

            generated_clips.append(
                clip
            )

            # ---------------------------------
            # Progress: 80 → 95
            # ---------------------------------

            job.progress = (
                80
                + int(
                    (
                        index
                        / total_candidates
                    )
                    * 15
                )
            )

            db.commit()

            logger.info(
                "Clip generated: "
                "video_id=%s clip=%s path=%s",
                video_id,
                index,
                generated_path,
            )

        # =================================
        # 12. Processing completed
        # =================================

        video.status = "completed"

        job.status = "completed"
        job.progress = 100
        job.completed_at = datetime.utcnow()

        db.commit()

        logger.info(
            "Video processing completed: "
            "video_id=%s job_id=%s clips=%s",
            video_id,
            job_id,
            len(generated_clips),
        )

        return {
            "video_id": video_id,
            "job_id": job_id,
            "status": "completed",
            "clips": len(generated_clips),
        }

    # =================================
    # Error handling
    # =================================

    except Exception as exc:

        db.rollback()

        logger.exception(
            "Video processing failed: "
            "video_id=%s job_id=%s",
            video_id,
            job_id,
        )

        try:

            video = db.get(
                Video,
                video_id,
            )

            job = db.get(
                ProcessingJob,
                job_id,
            )

            if video:
                video.status = "failed"

            if job:
                job.status = "failed"
                job.error = str(exc)

            db.commit()

        except Exception:

            db.rollback()

            logger.exception(
                "Failed to update failure status: "
                "video_id=%s job_id=%s",
                video_id,
                job_id,
            )

        raise

    finally:

        db.close()