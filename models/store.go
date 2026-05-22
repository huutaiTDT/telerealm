package models

type AppState struct {
	Users    []User       `json:"users"`
	Sessions []Session    `json:"sessions"`
	Bots     []Bot        `json:"bots"`
	Chats    []Chat       `json:"chats"`
	Files    []FileRecord `json:"files"`
}
