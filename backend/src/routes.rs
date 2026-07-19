//! Axum route handlers.
//!
//! Routes:
//!   GET /health              → 200 + {"status":"ok"}
//!   GET /profiles/:profile_id → 200 + ProfileRow JSON, or 404

use std::sync::Arc;

use axum::{
    Json, Router,
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::get,
};
use bigdecimal::BigDecimal;
use serde_json::json;
use sqlx::PgPool;
use tracing::error;

use crate::db;

/// App state shared across all handlers.
type AppState = Arc<PgPool>;

/// Build the Axum router.
pub fn router(pool: Arc<PgPool>) -> Router {
    Router::new()
        .route("/health", get(health))
        .route("/profiles/{profile_id}", get(get_profile))
        .route("/profiles/{profile_id}/followers", get(get_followers))
        .route("/profiles/{profile_id}/following", get(get_following))
        .with_state(pool)
}

/// `GET /health` — liveness check.
async fn health() -> impl IntoResponse {
    Json(json!({"status": "ok"}))
}

/// `GET /profiles/:profile_id`
///
/// `profile_id` is a decimal numeric string (u128 range). Returns the indexed
/// profile row as JSON, or 404 if it hasn't been ingested yet.
async fn get_profile(
    State(pool): State<AppState>,
    Path(profile_id_str): Path<String>,
) -> impl IntoResponse {
    // Parse the profile_id from the path. We accept any decimal integer string
    // (including values > i64::MAX which is why u128 is the right type here).
    let profile_id: BigDecimal = match profile_id_str.trim().parse() {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "profile_id must be a non-negative integer"})),
            )
                .into_response();
        }
    };

    match db::get_profile(&pool, &profile_id).await {
        Ok(Some(profile)) => (StatusCode::OK, Json(json!(profile))).into_response(),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(json!({"error": "profile not found"})),
        )
            .into_response(),
        Err(e) => {
            error!(error = %e, profile_id = %profile_id_str, "Database error in get_profile");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal server error"})),
            )
                .into_response()
        }
    }
}

/// `GET /profiles/:profile_id/followers`
///
/// Returns all profiles that follow `profile_id`, ordered oldest-first.
/// Returns `[]` (not 404) when the profile has no followers — zero followers
/// is a valid state, not a missing resource.
async fn get_followers(
    State(pool): State<AppState>,
    Path(profile_id_str): Path<String>,
) -> impl IntoResponse {
    let profile_id: bigdecimal::BigDecimal = match profile_id_str.trim().parse() {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "profile_id must be a non-negative integer"})),
            )
                .into_response();
        }
    };

    match db::get_followers(&pool, &profile_id).await {
        Ok(rows) => (StatusCode::OK, Json(json!(rows))).into_response(),
        Err(e) => {
            error!(error = %e, profile_id = %profile_id_str, "Database error in get_followers");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal server error"})),
            )
                .into_response()
        }
    }
}

/// `GET /profiles/:profile_id/following`
///
/// Returns all profiles that `profile_id` follows, ordered oldest-first.
/// Returns `[]` (not 404) when the profile follows nobody.
async fn get_following(
    State(pool): State<AppState>,
    Path(profile_id_str): Path<String>,
) -> impl IntoResponse {
    let profile_id: bigdecimal::BigDecimal = match profile_id_str.trim().parse() {
        Ok(v) => v,
        Err(_) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "profile_id must be a non-negative integer"})),
            )
                .into_response();
        }
    };

    match db::get_following(&pool, &profile_id).await {
        Ok(rows) => (StatusCode::OK, Json(json!(rows))).into_response(),
        Err(e) => {
            error!(error = %e, profile_id = %profile_id_str, "Database error in get_following");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "internal server error"})),
            )
                .into_response()
        }
    }
}

// ── Integration tests ──────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use bigdecimal::BigDecimal;
    use tower::ServiceExt;

    /// Integration test — requires a real Postgres database.
    ///
    /// Run with:
    ///   DATABASE_URL=postgres://localhost:5432/weave_test cargo test -- --ignored
    #[tokio::test]
    #[ignore = "requires Postgres: set DATABASE_URL and run sqlx migrate run first"]
    async fn test_get_profile_returns_inserted_row() {
        let database_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set for this integration test");
        let pool = sqlx::PgPool::connect(&database_url)
            .await
            .expect("failed to connect to Postgres");

        sqlx::migrate!("./migrations")
            .run(&pool)
            .await
            .expect("migrations failed");

        let test_id: BigDecimal = "99999".parse().unwrap();
        // Use the runtime query API (no DATABASE_URL needed at compile time).
        sqlx::query(
            r#"
            INSERT INTO profiles (profile_id, owner, handle, metadata_uri, created_at_ts)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (profile_id) DO UPDATE
              SET owner = EXCLUDED.owner,
                  handle = EXCLUDED.handle,
                  metadata_uri = EXCLUDED.metadata_uri,
                  created_at_ts = EXCLUDED.created_at_ts,
                  updated_at = now()
            "#,
        )
        .bind(&test_id)
        .bind("GTEST0000000000000000000000000000000000000000000000000001")
        .bind("test_profile")
        .bind("ipfs://test")
        .bind(1_700_000_000i64)
        .execute(&pool)
        .await
        .expect("insert failed");

        let app = router(Arc::new(pool));

        // Happy path: profile exists.
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/profiles/99999")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        let body = axum::body::to_bytes(response.into_body(), 1024 * 1024)
            .await
            .unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["handle"], "test_profile");
        assert_eq!(
            json["owner"],
            "GTEST0000000000000000000000000000000000000000000000000001"
        );

        // Not-found path.
        let response = app
            .oneshot(
                Request::builder()
                    .uri("/profiles/88888")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::NOT_FOUND);
    }

    /// Verify the health endpoint always returns 200 (no DB needed).
    #[tokio::test]
    async fn test_health_no_db() {
        // We need a real pool for the router type, but health never touches it.
        // Use a placeholder that won't be called.
        // Instead, test the handler directly.
        let response = health().await.into_response();
        assert_eq!(response.status(), StatusCode::OK);
    }

    /// Verify that a bad profile_id (non-numeric) returns 400.
    #[tokio::test]
    #[ignore = "requires Postgres: set DATABASE_URL"]
    async fn test_get_profile_bad_id_returns_400() {
        let database_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set for this integration test");
        let pool = sqlx::PgPool::connect(&database_url).await.unwrap();
        let app = router(Arc::new(pool));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/profiles/not-a-number")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
    }

    /// /followers returns [] (not 404) for a profile with no followers.
    #[tokio::test]
    #[ignore = "requires Postgres: set DATABASE_URL and run sqlx migrate run first"]
    async fn test_get_followers_empty_returns_200_not_404() {
        let database_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set for this integration test");
        let pool = sqlx::PgPool::connect(&database_url).await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        let app = router(Arc::new(pool));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/profiles/99998/followers")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json, serde_json::json!([]));
    }

    /// /following returns [] (not 404) for a profile that follows nobody.
    #[tokio::test]
    #[ignore = "requires Postgres: set DATABASE_URL and run sqlx migrate run first"]
    async fn test_get_following_empty_returns_200_not_404() {
        let database_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set for this integration test");
        let pool = sqlx::PgPool::connect(&database_url).await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        let app = router(Arc::new(pool));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/profiles/99998/following")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = axum::body::to_bytes(response.into_body(), 1024).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json, serde_json::json!([]));
    }

    /// Full follow round-trip: insert a follow row, verify it appears in /followers,
    /// then verify the follower appears in /following of the opposite side.
    #[tokio::test]
    #[ignore = "requires Postgres: set DATABASE_URL and run sqlx migrate run first"]
    async fn test_follow_roundtrip_via_endpoints() {
        let database_url = std::env::var("DATABASE_URL")
            .expect("DATABASE_URL must be set for this integration test");
        let pool = sqlx::PgPool::connect(&database_url).await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();

        let follower_id: bigdecimal::BigDecimal = "77771".parse().unwrap();
        let followee_id: bigdecimal::BigDecimal = "77772".parse().unwrap();

        // Clean up any leftover state from a previous run.
        sqlx::query("DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2")
            .bind(&follower_id)
            .bind(&followee_id)
            .execute(&pool)
            .await
            .unwrap();

        // Insert directly into follows (simulating what the ingest worker does).
        let mut tx = pool.begin().await.unwrap();
        crate::db::insert_follow(&mut tx, &follower_id, &followee_id, 1_700_000_001i64)
            .await
            .unwrap();
        tx.commit().await.unwrap();

        let app = router(Arc::new(pool.clone()));

        // followee's /followers should contain follower_id.
        let resp = app
            .clone()
            .oneshot(
                Request::builder()
                    .uri("/profiles/77772/followers")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), 4096).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert!(json.as_array().unwrap().iter().any(|r| {
            r["follower_id"].as_str().map(|s| s == "77771").unwrap_or(false)
        }));

        // follower's /following should contain followee_id.
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/profiles/77771/following")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = axum::body::to_bytes(resp.into_body(), 4096).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert!(json.as_array().unwrap().iter().any(|r| {
            r["followee_id"].as_str().map(|s| s == "77772").unwrap_or(false)
        }));
    }
}
