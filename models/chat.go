package models

import "time"

type Chat struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	BotID     string    `json:"bot_id"`
	ChatID    string    `json:"chat_id"`
	Title     string    `json:"title,omitempty"`
	Type      string    `json:"type,omitempty"`
	Selected  bool      `json:"selected"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ChatSummary struct {
	ChatID string `json:"chat_id"`
	Title  string `json:"title,omitempty"`
	Type   string `json:"type,omitempty"`
}
