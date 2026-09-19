import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import close_client, ensure_indexes, get_db
from app.routes import accounts as account_routes
from app.routes import auth as auth_routes
from app.routes import demo as demo_routes
from app.routes import notifications as notification_routes
from app.routes import payment_requests as payment_request_routes
from app.routes import payments as payment_routes
from app.routes import qr as qr_routes
from app.routes import transactions as transaction_routes
from app.routes import users as user_routes
from app.services import seed_service

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("braillepay")

settings = get_settings()

app = FastAPI(
    title="BraillePay API",
    description=(
        "Simulated, accessibility-first digital payments API. "
        "BraillePay is a DEMONSTRATION application: no real money moves, "
        "no real bank or UPI network is contacted. All users, banks, "
        "balances, QR codes and transactions are simulated inside "
        "this application's own database."
    ),
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    await ensure_indexes()
    
    # Automatically seed the database if demo mode is active
    if settings.demo_mode:
        try:
            db = get_db()
            await seed_service.seed_all(db)
            logger.info("Demo database seeded successfully on startup.")
        except Exception as e:
            logger.error(f"Failed to seed database on startup: {e}")

    logger.info("BraillePay backend started. DEMO_MODE=%s", settings.demo_mode)


@app.on_event("shutdown")
async def on_shutdown():
    await close_client()


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "service": "BraillePay", "simulation": True}


app.include_router(auth_routes.router)
app.include_router(account_routes.router)
app.include_router(user_routes.router)
app.include_router(payment_routes.router)
app.include_router(transaction_routes.router)
app.include_router(qr_routes.router)
app.include_router(payment_request_routes.router)
app.include_router(notification_routes.router)
app.include_router(demo_routes.router)
