import datetime as dt
import uuid

from pydantic import BaseModel, ConfigDict, Field, field_validator
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---------- auth ----------
class LoginIn(CamelModel):
    email: str | None = None
    password: str | None = None
    google_jwt: str | None = None
    microsoft_jwt: str | None = None


class TokenOut(CamelModel):
    successful: bool = True
    token: str


class RegisterIn(CamelModel):
    email: str = Field(min_length=3, max_length=320)
    password: str = Field(min_length=6, max_length=200)
    admin_bootstrap_token: str | None = None


class RegisterOut(CamelModel):
    successful: bool = True
    message: str


class UserOut(CamelModel):
    id: uuid.UUID
    email: str
    role: str | None
    api_key: uuid.UUID | None = None


class AdminUserOut(CamelModel):
    id: uuid.UUID
    email: str
    role: str | None


class UserIn(CamelModel):
    id: uuid.UUID | None = None
    email: str = Field(min_length=3, max_length=320)
    password: str | None = None
    role: str | None = None


class ApiKeyIn(CamelModel):
    api_key: uuid.UUID


class ApiKeyOut(CamelModel):
    api_key: uuid.UUID | None


# ---------- categories ----------
class CategoryIn(CamelModel):
    id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=200)
    description: str = ""


class CategoryOut(CamelModel):
    id: uuid.UUID
    name: str
    description: str


class RecentCategoryIn(CamelModel):
    category_id: uuid.UUID | None = None


class RecentCategoryOut(CamelModel):
    category_id: uuid.UUID | None


# ---------- items ----------
class ItemIn(CamelModel):
    id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=500)
    description: str = ""
    value: float = Field(default=0.0, allow_inf_nan=False)
    active: bool = True
    tags: list[str] = Field(default_factory=list)
    category_id: uuid.UUID


class FileOut(CamelModel):
    id: uuid.UUID
    name: str
    size: int


class ItemOut(CamelModel):
    id: uuid.UUID
    name: str
    description: str
    value: float
    active: bool
    tags: list[str]
    sequence_number: float
    category_id: uuid.UUID
    category_name: str
    created: dt.datetime
    modified: dt.datetime
    files: list[FileOut] = Field(default_factory=list)

    @field_validator("created", "modified")
    @classmethod
    def _as_utc(cls, value: dt.datetime) -> dt.datetime:
        # SQLite returns naive datetimes; all stored values are UTC
        return value.replace(tzinfo=dt.timezone.utc) if value.tzinfo is None else value


class MoveOut(CamelModel):
    moved: bool


class ImportOut(CamelModel):
    imported: int
    errors: list[str]


class ExternalItemIn(CamelModel):
    id: uuid.UUID | None = None
    name: str = Field(min_length=1, max_length=500)
    description: str = ""
    value: float = Field(default=0.0, allow_inf_nan=False)
    category_name: str = "default"


class ExternalDeleteIn(CamelModel):
    id: uuid.UUID
