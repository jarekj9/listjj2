import datetime as dt
import uuid

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, LargeBinary, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> dt.datetime:
    return dt.datetime.now(dt.timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str | None] = mapped_column(String(20))  # "User" | "Admin" | None = pending approval
    api_key: Mapped[uuid.UUID | None] = mapped_column(Uuid, unique=True)
    recent_category_id: Mapped[uuid.UUID | None] = mapped_column(Uuid)
    created: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    created: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Item(Base):
    __tablename__ = "items"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("users.id", ondelete="CASCADE"), index=True)
    category_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("categories.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    value: Mapped[float] = mapped_column(Float, default=0.0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    tags: Mapped[str] = mapped_column(Text, default="")
    sequence_number: Mapped[float] = mapped_column(Float, default=0.0, index=True)
    created: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    modified: Mapped[dt.datetime] = mapped_column(DateTime(timezone=True), default=utcnow)

    category: Mapped[Category] = relationship()
    files: Mapped[list["File"]] = relationship(
        back_populates="item", cascade="all, delete-orphan", passive_deletes=True, order_by="File.name"
    )

    @property
    def tag_list(self) -> list[str]:
        return [t for t in self.tags.split(",") if t]


class File(Base):
    __tablename__ = "files"

    id: Mapped[uuid.UUID] = mapped_column(Uuid, primary_key=True, default=uuid.uuid4)
    item_id: Mapped[uuid.UUID] = mapped_column(Uuid, ForeignKey("items.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(500))
    size: Mapped[int] = mapped_column(Integer)
    content: Mapped[bytes] = mapped_column(LargeBinary, deferred=True)

    item: Mapped[Item] = relationship(back_populates="files")
