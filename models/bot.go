package models

import "time"

type Bot struct {
	ID           string    `json:"id"`
	UserID       string    `json:"user_id"`
	Name         string    `json:"name"`
	Token        string    `json:"-"`
	Username     string    `json:"username,omitempty"`
	FirstName    string    `json:"first_name,omitempty"`
	ActiveChatID string    `json:"active_chat_id,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type BotCreateRequest struct {
	Name  string `json:"name"`
	Token string `json:"token"`
}
