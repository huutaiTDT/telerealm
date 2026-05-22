package middleware

import (
	"net/http"
	"strings"

	"telerealm/models"

	"github.com/gin-gonic/gin"
)

type SessionStore interface {
	GetSession(token string) (models.Session, bool)
	GetUserByID(userID string) (models.User, bool)
}

func SessionAuthRequired(store SessionStore) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization format, Bearer token required"})
			c.Abort()
			return
		}

		token := strings.TrimSpace(strings.TrimPrefix(authHeader, "Bearer "))
		if token == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Empty token"})
			c.Abort()
			return
		}

		session, exists := store.GetSession(token)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid or expired session"})
			c.Abort()
			return
		}

		user, exists := store.GetUserByID(session.UserID)
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "User not found"})
			c.Abort()
			return
		}

		c.Set("session_token", token)
		c.Set("session", session)
		c.Set("user", user)
		c.Set("user_id", user.ID)
		c.Next()
	}
}
