package api

import (
	"fmt"
	"net/http"
	"strings"

	"telerealm/models"

	"github.com/gin-gonic/gin"
)

type Handlers struct {
	service *Service
}

func NewHandlers(service *Service) *Handlers {
	return &Handlers{service: service}
}

func publicSecureURL(c *gin.Context, secureURL string) string {
	secureURL = strings.TrimSpace(secureURL)
	if secureURL == "" {
		return ""
	}
	if strings.HasPrefix(secureURL, "http://") || strings.HasPrefix(secureURL, "https://") {
		return secureURL
	}

	scheme := c.Request.Header.Get("X-Forwarded-Proto")
	if scheme == "" {
		scheme = "http"
	}

	if strings.HasPrefix(secureURL, "/") {
		return fmt.Sprintf("%s://%s%s", scheme, c.Request.Host, secureURL)
	}

	return fmt.Sprintf("%s://%s/%s", scheme, c.Request.Host, secureURL)
}

func normalizeFileRecordForResponse(c *gin.Context, record models.FileRecord) models.FileRecord {
	record.SecureURL = publicSecureURL(c, record.SecureURL)
	return record
}

func normalizeFileRecordsForResponse(c *gin.Context, records []models.FileRecord) []models.FileRecord {
	if len(records) == 0 {
		return records
	}
	output := make([]models.FileRecord, 0, len(records))
	for _, record := range records {
		output = append(output, normalizeFileRecordForResponse(c, record))
	}
	return output
}

func (h *Handlers) Register(c *gin.Context) {
	var req models.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}

	user, token, err := h.service.Register(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, models.Response{Success: true, Message: "User registered successfully", Data: gin.H{"token": token, "user": user}})
}

func (h *Handlers) Login(c *gin.Context) {
	var req models.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}

	user, token, err := h.service.Login(req)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.Response{Success: true, Message: "Login successful", Data: gin.H{"token": token, "user": user}})
}

func (h *Handlers) Me(c *gin.Context) {
	user := c.MustGet("user").(models.User)
	c.JSON(http.StatusOK, models.Response{Success: true, Message: "Current user", Data: user})
}

func (h *Handlers) ListBots(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	bots := h.service.ListBots(userID)
	c.JSON(http.StatusOK, models.Response{Success: true, Message: "Bots loaded", Data: bots})
}

func (h *Handlers) CreateBot(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	var req models.BotCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}

	bot, chats, err := h.service.CreateBot(userID, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, models.Response{Success: true, Message: "Bot connected and chats loaded", Data: gin.H{"bot": bot, "chats": chats}})
}

func (h *Handlers) SyncChats(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	botID := c.Param("botID")
	chats, err := h.service.SyncChats(userID, botID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.Response{Success: true, Message: "Chats synced", Data: chats})
}

func (h *Handlers) ListChats(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	botID := c.Param("botID")
	chats, err := h.service.ListChats(userID, botID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.Response{Success: true, Message: "Chats loaded", Data: chats})
}

func (h *Handlers) SelectChat(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	botID := c.Param("botID")
	chatID := c.Param("chatID")
	chat, err := h.service.SelectChat(userID, botID, chatID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.Response{Success: true, Message: "Chat selected", Data: chat})
}

func (h *Handlers) ListFiles(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	botID := c.Param("botID")
	chatID := c.Param("chatID")
	files := normalizeFileRecordsForResponse(c, h.service.ListFiles(userID, botID, chatID))
	c.JSON(http.StatusOK, models.Response{Success: true, Message: "Files loaded", Data: files})
}

func (h *Handlers) CreateFile(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	botID := c.Param("botID")
	chatID := c.Param("chatID")
	folderName := strings.TrimSpace(c.PostForm("folder_name"))

	fileHeader, err := c.FormFile("document")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "document is required"})
		return
	}

	file, err := fileHeader.Open()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to open file"})
		return
	}
	defer file.Close()

	record, err := h.service.CreateFile(userID, botID, chatID, file, fileHeader.Filename, folderName)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, models.Response{Success: true, Message: "File uploaded", Data: normalizeFileRecordForResponse(c, record)})
}

func (h *Handlers) GetFile(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	fileID := c.Param("id")
	record, err := h.service.GetFile(userID, fileID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.Response{Success: true, Message: "File loaded", Data: normalizeFileRecordForResponse(c, record)})
}

func (h *Handlers) UpdateFile(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	fileID := c.Param("id")
	var req models.FileRecordUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request payload"})
		return
	}
	if req.ChatID == nil && req.OriginalName == nil && req.FolderName == nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "at least one updatable field is required"})
		return
	}

	record, err := h.service.UpdateFile(userID, fileID, req)
	if err != nil {
		status := http.StatusBadRequest
		if strings.Contains(strings.ToLower(err.Error()), "not found") {
			status = http.StatusNotFound
		}
		c.JSON(status, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.Response{Success: true, Message: "File updated", Data: normalizeFileRecordForResponse(c, record)})
}

func (h *Handlers) DeleteFile(c *gin.Context) {
	userID := c.MustGet("user_id").(string)
	fileID := c.Param("id")
	if err := h.service.DeleteFile(userID, fileID); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, models.Response{Success: true, Message: "File deleted", Data: gin.H{"record_id": fileID}})
}

func (h *Handlers) DownloadFile(c *gin.Context) {
	key := strings.TrimSpace(c.Param("key"))
	if key == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "missing key"})
		return
	}

	fileURL, err := h.service.ResolveDownload(key)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("failed to resolve file: %v", err)})
		return
	}

	c.Redirect(http.StatusFound, fileURL)
}
