package api

import (
	"os"

	"telerealm/middleware"
	"telerealm/repositories"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func NewRouter() (*gin.Engine, error) {
	databaseURL := os.Getenv("DATABASE_URL")
	store, err := NewStore(databaseURL)
	if err != nil {
		return nil, err
	}

	service := NewService(store, repositories.NewFileRepository())
	handlers := NewHandlers(service)

	r := gin.Default()
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	config.AllowHeaders = []string{"Origin", "Content-Type", "Authorization"}
	r.Use(cors.New(config))

	r.Static("/ui", "./ui")
	r.Static("/assets", "./ui")
	r.GET("/", func(c *gin.Context) {
		c.File("./ui/index.html")
	})
	r.GET("/app", func(c *gin.Context) {
		c.File("./ui/index.html")
	})
	r.GET("/login", func(c *gin.Context) {
		c.File("./ui/index.html")
	})
	r.GET("/register", func(c *gin.Context) {
		c.File("./ui/index.html")
	})
	r.GET("/drive/:key", handlers.DownloadFile)
	r.GET("/ping", func(c *gin.Context) {
		c.JSON(200, gin.H{"message": "pong"})
	})

	auth := r.Group("/api")
	{
		auth.POST("/auth/register", handlers.Register)
		auth.POST("/auth/login", handlers.Login)
		secure := auth.Group("")
		secure.Use(middleware.SessionAuthRequired(store))
		{
			secure.GET("/me", handlers.Me)
			secure.PUT("/users/theme", handlers.UpdateTheme)
			secure.GET("/bots", handlers.ListBots)
			secure.POST("/bots", handlers.CreateBot)
			secure.POST("/bots/:botID/sync", handlers.SyncChats)
			secure.GET("/bots/:botID/chats", handlers.ListChats)
			secure.POST("/bots/:botID/chats/:chatID/select", handlers.SelectChat)
			secure.GET("/bots/:botID/chats/:chatID/files", handlers.ListFiles)
			secure.POST("/bots/:botID/chats/:chatID/files", handlers.CreateFile)
			secure.GET("/files/:id", handlers.GetFile)
			secure.PATCH("/files/:id", handlers.UpdateFile)
			secure.DELETE("/files/:id", handlers.DeleteFile)
		}
	}

	r.NoRoute(func(c *gin.Context) {
		if len(c.Request.URL.Path) >= 4 && c.Request.URL.Path[:4] == "/api" {
			c.JSON(404, gin.H{"error": "not found"})
			return
		}
		c.File("./ui/index.html")
	})

	return r, nil
}
