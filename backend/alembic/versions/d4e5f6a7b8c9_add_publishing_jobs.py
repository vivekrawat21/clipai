"""add publishing jobs table

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-06 18:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, Sequence[str], None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'publishing_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('clip_id', sa.Integer(), nullable=False),
        sa.Column('platform', sa.String(length=30), nullable=False),
        sa.Column('status', sa.String(length=30), nullable=False),
        sa.Column('progress', sa.Integer(), nullable=False),
        sa.Column('external_id', sa.String(length=255), nullable=True),
        sa.Column('external_url', sa.String(length=500), nullable=True),
        sa.Column('payload', sa.Text(), nullable=True),
        sa.Column('error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['clip_id'], ['clips.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_publishing_jobs_clip_id'), 'publishing_jobs', ['clip_id'], unique=False)
    op.create_index(op.f('ix_publishing_jobs_platform'), 'publishing_jobs', ['platform'], unique=False)
    op.create_index(op.f('ix_publishing_jobs_status'), 'publishing_jobs', ['status'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_publishing_jobs_status'), table_name='publishing_jobs')
    op.drop_index(op.f('ix_publishing_jobs_platform'), table_name='publishing_jobs')
    op.drop_index(op.f('ix_publishing_jobs_clip_id'), table_name='publishing_jobs')
    op.drop_table('publishing_jobs')