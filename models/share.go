package models

import "time"

type ShareLink struct {
	ID        string    `json:"id"`
	OwnerID   string    `json:"owner_id"`
	Token     string    `json:"token"`
	Title     string    `json:"title,omitempty"`
	Note      string    `json:"note,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type ShareLinkCreateRequest struct {
	FileIDs         []string `json:"file_ids"`
	RecipientEmails  []string `json:"recipient_emails"`
	Title           string   `json:"title"`
	Note            string   `json:"note"`
}

type SharedFileView struct {
	ShareLink
	ShareURL string       `json:"share_url"`
	Files    []FileRecord `json:"files"`
}
