package models

import "time"

type FileRecord struct {
	BotToken     string    `json:"-"`
	RecordID     string    `json:"record_id"`
	UserID       string    `json:"user_id,omitempty"`
	BotID        string    `json:"bot_id,omitempty"`
	BotName      string    `json:"bot_name,omitempty"`
	BotUsername  string    `json:"bot_username,omitempty"`
	FileID       string    `json:"file_id"`
	ChatID       string    `json:"chat_id,omitempty"`
	ChatTitle    string    `json:"chat_title,omitempty"`
	ChatType     string    `json:"chat_type,omitempty"`
	FolderName   string    `json:"folder_name,omitempty"`
	URL          string    `json:"url"`
	SecureURL    string    `json:"secure_url"`
	Bytes        int       `json:"bytes"`
	Format       string    `json:"format,omitempty"`
	OriginalName string    `json:"original_name,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type FileRecordUpdateRequest struct {
	ChatID       *string `json:"chat_id,omitempty"`
	OriginalName *string `json:"original_name,omitempty"`
	FolderName   *string `json:"folder_name,omitempty"`
}