"""add transcript words table

Revision ID: a1b2c3d4e5f6
Revises: 80dbb48a43e5
Create Date: 2026-09-06 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = '80dbb48a43e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'transcript_words',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('segment_id', sa.Integer(), nullable=False),
        sa.Column('video_id', sa.Integer(), nullable=False),
        sa.Column('word', sa.String(length=500), nullable=False),
        sa.Column('start_time', sa.Float(), nullable=False),
        sa.Column('end_time', sa.Float(), nullable=False),
        sa.Column('order_index', sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(['segment_id'], ['transcript_segments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['video_id'], ['videos.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_transcript_words_segment_id'), 'transcript_words', ['segment_id'], unique=False)
    op.create_index(op.f('ix_transcript_words_video_id'), 'transcript_words', ['video_id'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_transcript_words_video_id'), table_name='transcript_words')
    op.drop_index(op.f('ix_transcript_words_segment_id'), table_name='transcript_words')
    op.drop_table('transcript_words')
