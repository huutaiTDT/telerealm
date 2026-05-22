package api

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"telerealm/models"
	"telerealm/repositories"
	"telerealm/utils"

	"github.com/google/uuid"
	_ "github.com/jackc/pgx/v5/stdlib"
)

type Store struct {
	db *sql.DB
}

func NewStore(source string) (*Store, error) {
	dsn := strings.TrimSpace(source)
	if dsn == "" || !strings.Contains(strings.ToLower(dsn), "postgres") {
		dsn = buildDatabaseURL()
	}
	if dsn == "" {
		return nil, fmt.Errorf("database configuration is required")
	}

	db, err := sql.Open("pgx", dsn)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}

	store := &Store{db: db}
	if err := store.ensureSchema(context.Background()); err != nil {
		_ = db.Close()
		return nil, err
	}

	return store, nil
}

func buildDatabaseURL() string {
	if dsn := strings.TrimSpace(os.Getenv("DATABASE_URL")); dsn != "" {
		return dsn
	}

	host := strings.TrimSpace(os.Getenv("DB_HOST"))
	port := strings.TrimSpace(os.Getenv("DB_PORT"))
	user := strings.TrimSpace(os.Getenv("DB_USERNAME"))
	password := strings.TrimSpace(os.Getenv("DB_PASSWORD"))
	database := strings.TrimSpace(os.Getenv("DB_DATABASE"))
	sslmode := strings.TrimSpace(os.Getenv("DB_SSLMODE"))
	if sslmode == "" {
		sslmode = "disable"
	}

	if host == "" || port == "" || user == "" || password == "" || database == "" {
		return ""
	}

	hostPort := net.JoinHostPort(host, port)
	dsn := url.URL{
		Scheme: "postgres",
		User:   url.UserPassword(user, password),
		Host:   hostPort,
		Path:   database,
	}
	query := dsn.Query()
	query.Set("sslmode", sslmode)
	dsn.RawQuery = query.Encode()
	return dsn.String()
}

func (s *Store) ensureSchema(ctx context.Context) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	statements := []string{
		`CREATE TABLE IF NOT EXISTS users (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			email TEXT NOT NULL UNIQUE,
			password_hash TEXT NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`ALTER TABLE users ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light'`,
		`CREATE TABLE IF NOT EXISTS sessions (
			token TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			expires_at TIMESTAMPTZ NOT NULL,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS bots (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			name TEXT NOT NULL,
			token TEXT NOT NULL,
			username TEXT,
			first_name TEXT,
			active_chat_id TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE TABLE IF NOT EXISTS chats (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
			chat_id TEXT NOT NULL,
			title TEXT,
			type TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			UNIQUE(user_id, bot_id, chat_id)
		)`,
		`CREATE TABLE IF NOT EXISTS files (
			record_id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			bot_id TEXT NOT NULL REFERENCES bots(id) ON DELETE CASCADE,
			bot_token TEXT NOT NULL,
			bot_name TEXT,
			bot_username TEXT,
			file_id TEXT NOT NULL,
			chat_id TEXT NOT NULL,
			chat_title TEXT,
			chat_type TEXT,
			folder_name TEXT,
			url TEXT NOT NULL,
			secure_url TEXT NOT NULL,
			bytes BIGINT NOT NULL,
			format TEXT,
			original_name TEXT,
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)`,
		`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_bots_user_id ON bots(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_chats_lookup ON chats(user_id, bot_id, chat_id)`,
		`CREATE INDEX IF NOT EXISTS idx_files_lookup ON files(user_id, bot_id, chat_id)`,
		`ALTER TABLE files ADD COLUMN IF NOT EXISTS folder_name TEXT`,
	}

	for _, statement := range statements {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Store) Close() error {
	if s == nil || s.db == nil {
		return nil
	}
	return s.db.Close()
}

func (s *Store) GetSession(token string) (models.Session, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var session models.Session
	var createdAt time.Time
	if err := s.db.QueryRowContext(ctx, `
		SELECT token, user_id, expires_at, created_at
		FROM sessions
		WHERE token = $1 AND expires_at > NOW()
	`, token).Scan(&session.Token, &session.UserID, &session.ExpiresAt, &createdAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.Session{}, false
		}
		return models.Session{}, false
	}

	session.CreatedAt = createdAt
	return session, true
}

func (s *Store) GetUserByID(userID string) (models.User, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var user models.User
	if err := s.db.QueryRowContext(ctx, `
		SELECT id, name, email, password_hash, created_at, updated_at, theme
		FROM users
		WHERE id = $1
	`, userID).Scan(&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt, &user.Theme); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.User{}, false
		}
		return models.User{}, false
	}

	return user, true
}

func (s *Store) GetUserBySession(token string) (models.User, bool) {
	session, exists := s.GetSession(token)
	if !exists {
		return models.User{}, false
	}

	return s.GetUserByID(session.UserID)
}

func (s *Store) RegisterUser(req models.RegisterRequest) (models.User, string, error) {
	name := strings.TrimSpace(req.Name)
	email := strings.ToLower(strings.TrimSpace(req.Email))
	password := strings.TrimSpace(req.Password)
	if name == "" || email == "" || password == "" {
		return models.User{}, "", fmt.Errorf("name, email, and password are required")
	}
	if len(password) < 8 {
		return models.User{}, "", fmt.Errorf("password must be at least 8 characters")
	}

	hash, err := utils.HashPassword(password)
	if err != nil {
		return models.User{}, "", err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return models.User{}, "", err
	}
	defer tx.Rollback()

	var existingID string
	err = tx.QueryRowContext(ctx, `SELECT id FROM users WHERE lower(email) = lower($1)`, email).Scan(&existingID)
	if err == nil {
		return models.User{}, "", fmt.Errorf("email already registered")
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return models.User{}, "", err
	}

	now := time.Now().UTC()
	user := models.User{
		ID:           uuid.NewString(),
		Name:         name,
		Email:        email,
		PasswordHash: hash,
		CreatedAt:    now,
		UpdatedAt:    now,
		Theme:        "light",
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO users (id, name, email, password_hash, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, user.ID, user.Name, user.Email, user.PasswordHash, user.CreatedAt, user.UpdatedAt); err != nil {
		return models.User{}, "", err
	}

	session := models.Session{
		Token:     uuid.NewString(),
		UserID:    user.ID,
		ExpiresAt: now.Add(30 * 24 * time.Hour),
		CreatedAt: now,
	}
	if _, err := tx.ExecContext(ctx, `
		INSERT INTO sessions (token, user_id, expires_at, created_at)
		VALUES ($1, $2, $3, $4)
	`, session.Token, session.UserID, session.ExpiresAt, session.CreatedAt); err != nil {
		return models.User{}, "", err
	}

	if err := tx.Commit(); err != nil {
		return models.User{}, "", err
	}

	return user, session.Token, nil
}

func (s *Store) LoginUser(email, password string) (models.User, string, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	password = strings.TrimSpace(password)
	if email == "" || password == "" {
		return models.User{}, "", fmt.Errorf("email and password are required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	var user models.User
	if err := s.db.QueryRowContext(ctx, `
		SELECT id, name, email, password_hash, created_at, updated_at, theme
		FROM users
		WHERE lower(email) = lower($1)
	`, email).Scan(&user.ID, &user.Name, &user.Email, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt, &user.Theme); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.User{}, "", fmt.Errorf("invalid credentials")
		}
		return models.User{}, "", err
	}

	if !utils.VerifyPassword(user.PasswordHash, password) {
		return models.User{}, "", fmt.Errorf("invalid credentials")
	}

	now := time.Now().UTC()
	session := models.Session{
		Token:     uuid.NewString(),
		UserID:    user.ID,
		ExpiresAt: now.Add(30 * 24 * time.Hour),
		CreatedAt: now,
	}
	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO sessions (token, user_id, expires_at, created_at)
		VALUES ($1, $2, $3, $4)
	`, session.Token, session.UserID, session.ExpiresAt, session.CreatedAt); err != nil {
		return models.User{}, "", err
	}

	return user, session.Token, nil
}

func (s *Store) CreateBot(userID string, bot models.Bot) (models.Bot, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return models.Bot{}, fmt.Errorf("user_id is required")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now().UTC()
	bot.ID = uuid.NewString()
	bot.UserID = userID
	bot.CreatedAt = now
	bot.UpdatedAt = now

	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO bots (id, user_id, name, token, username, first_name, active_chat_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, bot.ID, bot.UserID, bot.Name, bot.Token, bot.Username, bot.FirstName, bot.ActiveChatID, bot.CreatedAt, bot.UpdatedAt); err != nil {
		return models.Bot{}, err
	}

	return bot, nil
}

func (s *Store) UpdateBot(bot models.Bot) error {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	bot.UpdatedAt = time.Now().UTC()
	result, err := s.db.ExecContext(ctx, `
		UPDATE bots
		SET name = $1, token = $2, username = $3, first_name = $4, active_chat_id = $5, updated_at = $6
		WHERE id = $7 AND user_id = $8
	`, bot.Name, bot.Token, bot.Username, bot.FirstName, bot.ActiveChatID, bot.UpdatedAt, bot.ID, bot.UserID)
	if err != nil {
		return err
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return fmt.Errorf("bot not found")
	}

	return nil
}

func (s *Store) ListBots(userID string) []models.Bot {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := s.db.QueryContext(ctx, `
		SELECT id, user_id, name, token, username, first_name, COALESCE(active_chat_id, ''), created_at, updated_at
		FROM bots
		WHERE user_id = $1
		ORDER BY created_at DESC
	`, userID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	bots := make([]models.Bot, 0)
	for rows.Next() {
		var bot models.Bot
		if err := rows.Scan(&bot.ID, &bot.UserID, &bot.Name, &bot.Token, &bot.Username, &bot.FirstName, &bot.ActiveChatID, &bot.CreatedAt, &bot.UpdatedAt); err != nil {
			continue
		}
		bots = append(bots, bot)
	}

	return bots
}

func (s *Store) GetBot(userID, botID string) (models.Bot, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var bot models.Bot
	if err := s.db.QueryRowContext(ctx, `
		SELECT id, user_id, name, token, username, first_name, COALESCE(active_chat_id, ''), created_at, updated_at
		FROM bots
		WHERE id = $1 AND user_id = $2
	`, botID, userID).Scan(&bot.ID, &bot.UserID, &bot.Name, &bot.Token, &bot.Username, &bot.FirstName, &bot.ActiveChatID, &bot.CreatedAt, &bot.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.Bot{}, false
		}
		return models.Bot{}, false
	}

	return bot, true
}

func (s *Store) UpsertChats(userID, botID string, chats []models.ChatSummary) ([]models.Chat, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	bot, found := s.findBotTx(ctx, tx, userID, botID)
	if !found {
		return nil, fmt.Errorf("bot not found")
	}

	now := time.Now().UTC()
	updatedChats := make([]models.Chat, 0, len(chats))
	for _, chatSummary := range chats {
		chat := models.Chat{
			ID:        uuid.NewString(),
			UserID:    userID,
			BotID:     botID,
			ChatID:    chatSummary.ChatID,
			Title:     chatSummary.Title,
			Type:      chatSummary.Type,
			CreatedAt: now,
			UpdatedAt: now,
		}

		if err := tx.QueryRowContext(ctx, `
			INSERT INTO chats (id, user_id, bot_id, chat_id, title, type, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
			ON CONFLICT (user_id, bot_id, chat_id)
			DO UPDATE SET title = EXCLUDED.title, type = EXCLUDED.type, updated_at = EXCLUDED.updated_at
			RETURNING id, user_id, bot_id, chat_id, COALESCE(title, ''), COALESCE(type, ''), created_at, updated_at
		`, chat.ID, chat.UserID, chat.BotID, chat.ChatID, chat.Title, chat.Type, chat.CreatedAt, chat.UpdatedAt).Scan(&chat.ID, &chat.UserID, &chat.BotID, &chat.ChatID, &chat.Title, &chat.Type, &chat.CreatedAt, &chat.UpdatedAt); err != nil {
			return nil, err
		}
		updatedChats = append(updatedChats, chat)
	}

	bot.UpdatedAt = now
	if _, err := tx.ExecContext(ctx, `
		UPDATE bots SET updated_at = $1 WHERE id = $2 AND user_id = $3
	`, bot.UpdatedAt, bot.ID, bot.UserID); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return updatedChats, nil
}

func (s *Store) ListChats(userID, botID string) []models.Chat {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	rows, err := s.db.QueryContext(ctx, `
		SELECT c.id, c.user_id, c.bot_id, c.chat_id, COALESCE(c.title, ''), COALESCE(c.type, ''),
			CASE WHEN COALESCE(b.active_chat_id, '') = c.chat_id THEN TRUE ELSE FALSE END AS selected,
			c.created_at, c.updated_at
		FROM chats c
		JOIN bots b ON b.id = c.bot_id AND b.user_id = c.user_id
		WHERE c.user_id = $1 AND c.bot_id = $2
		ORDER BY selected DESC, c.updated_at DESC
	`, userID, botID)
	if err != nil {
		return nil
	}
	defer rows.Close()

	chats := make([]models.Chat, 0)
	for rows.Next() {
		var chat models.Chat
		if err := rows.Scan(&chat.ID, &chat.UserID, &chat.BotID, &chat.ChatID, &chat.Title, &chat.Type, &chat.Selected, &chat.CreatedAt, &chat.UpdatedAt); err != nil {
			continue
		}
		chats = append(chats, chat)
	}

	return chats
}

func (s *Store) SelectChat(userID, botID, chatID string) (models.Chat, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return models.Chat{}, err
	}
	defer tx.Rollback()

	var chat models.Chat
	if err := tx.QueryRowContext(ctx, `
		SELECT id, user_id, bot_id, chat_id, COALESCE(title, ''), COALESCE(type, ''), created_at, updated_at
		FROM chats
		WHERE user_id = $1 AND bot_id = $2 AND chat_id = $3
	`, userID, botID, chatID).Scan(&chat.ID, &chat.UserID, &chat.BotID, &chat.ChatID, &chat.Title, &chat.Type, &chat.CreatedAt, &chat.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.Chat{}, fmt.Errorf("chat not found")
		}
		return models.Chat{}, err
	}

	if _, err := tx.ExecContext(ctx, `
		UPDATE bots SET active_chat_id = $1, updated_at = $2 WHERE id = $3 AND user_id = $4
	`, chat.ChatID, time.Now().UTC(), botID, userID); err != nil {
		return models.Chat{}, err
	}

	if err := tx.Commit(); err != nil {
		return models.Chat{}, err
	}

	chat.Selected = true
	return chat, nil
}

func (s *Store) ListFiles(userID, botID, chatID string) []models.FileRecord {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	query := `
		SELECT record_id, user_id, bot_id, bot_token, COALESCE(bot_name, ''), COALESCE(bot_username, ''), file_id, chat_id,
			COALESCE(chat_title, ''), COALESCE(chat_type, ''), COALESCE(folder_name, ''), url, secure_url, bytes, COALESCE(format, ''), COALESCE(original_name, ''), created_at, updated_at
		FROM files
		WHERE user_id = $1 AND bot_id = $2
	`
	args := []interface{}{userID, botID}
	if strings.TrimSpace(chatID) != "" {
		query += " AND chat_id = $3"
		args = append(args, chatID)
	}
	query += " ORDER BY created_at DESC"

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil
	}
	defer rows.Close()

	files := make([]models.FileRecord, 0)
	for rows.Next() {
		var file models.FileRecord
		var bytesValue int64
		if err := rows.Scan(&file.RecordID, &file.UserID, &file.BotID, &file.BotToken, &file.BotName, &file.BotUsername, &file.FileID, &file.ChatID, &file.ChatTitle, &file.ChatType, &file.FolderName, &file.URL, &file.SecureURL, &bytesValue, &file.Format, &file.OriginalName, &file.CreatedAt, &file.UpdatedAt); err != nil {
			continue
		}
		file.Bytes = int(bytesValue)
		files = append(files, file)
	}

	return files
}

// CountFiles returns the total number of files for a chat (or bot) with optional chat filter.
func (s *Store) CountFiles(userID, botID, chatID string) (int, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    query := `SELECT COUNT(*) FROM files WHERE user_id = $1 AND bot_id = $2`
    args := []interface{}{userID, botID}
    if strings.TrimSpace(chatID) != "" {
        query += ` AND chat_id = $3`
        args = append(args, chatID)
    }
    var count int
    if err := s.db.QueryRowContext(ctx, query, args...).Scan(&count); err != nil {
        return 0, err
    }
    return count, nil
}

// ListFilesPaginated returns a slice of FileRecord with pagination support.
func (s *Store) ListFilesPaginated(userID, botID, chatID string, offset, limit int) ([]models.FileRecord, error) {
    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()

    query := `
        SELECT record_id, user_id, bot_id, bot_token, COALESCE(bot_name, ''), COALESCE(bot_username, ''), file_id, chat_id,
            COALESCE(chat_title, ''), COALESCE(chat_type, ''), COALESCE(folder_name, ''), url, secure_url, bytes, COALESCE(format, ''), COALESCE(original_name, ''), created_at, updated_at
        FROM files
        WHERE user_id = $1 AND bot_id = $2`
    args := []interface{}{userID, botID}
    if strings.TrimSpace(chatID) != "" {
        query += ` AND chat_id = $3`
        args = append(args, chatID)
    }
    query += ` ORDER BY created_at DESC OFFSET $%d LIMIT $%d`
    // placeholder indices depend on number of args already
    offsetIdx := len(args) + 1
    limitIdx := len(args) + 2
    query = fmt.Sprintf(query, offsetIdx, limitIdx)
    args = append(args, offset, limit)

    rows, err := s.db.QueryContext(ctx, query, args...)
    if err != nil {
        return nil, err
    }
    defer rows.Close()

    files := make([]models.FileRecord, 0)
    for rows.Next() {
        var file models.FileRecord
        var bytesValue int64
        if err := rows.Scan(&file.RecordID, &file.UserID, &file.BotID, &file.BotToken, &file.BotName, &file.BotUsername, &file.FileID, &file.ChatID, &file.ChatTitle, &file.ChatType, &file.FolderName, &file.URL, &file.SecureURL, &bytesValue, &file.Format, &file.OriginalName, &file.CreatedAt, &file.UpdatedAt); err != nil {
            continue
        }
        file.Bytes = int(bytesValue)
        files = append(files, file)
    }
    return files, nil
}

func (s *Store) GetFile(userID, fileID string) (models.FileRecord, bool) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var file models.FileRecord
	var bytesValue int64
	if err := s.db.QueryRowContext(ctx, `
		SELECT record_id, user_id, bot_id, bot_token, COALESCE(bot_name, ''), COALESCE(bot_username, ''), file_id, chat_id,
			COALESCE(chat_title, ''), COALESCE(chat_type, ''), COALESCE(folder_name, ''), url, secure_url, bytes, COALESCE(format, ''), COALESCE(original_name, ''), created_at, updated_at
		FROM files
		WHERE user_id = $1 AND record_id = $2
	`, userID, fileID).Scan(&file.RecordID, &file.UserID, &file.BotID, &file.BotToken, &file.BotName, &file.BotUsername, &file.FileID, &file.ChatID, &file.ChatTitle, &file.ChatType, &file.FolderName, &file.URL, &file.SecureURL, &bytesValue, &file.Format, &file.OriginalName, &file.CreatedAt, &file.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.FileRecord{}, false
		}
		return models.FileRecord{}, false
	}
	file.Bytes = int(bytesValue)

	return file, true
}

func (s *Store) CreateFileRecord(record models.FileRecord) (models.FileRecord, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	now := time.Now().UTC()
	record.CreatedAt = now
	record.UpdatedAt = now

	if _, err := s.db.ExecContext(ctx, `
		INSERT INTO files (
			record_id, user_id, bot_id, bot_token, bot_name, bot_username, file_id, chat_id, chat_title, chat_type, folder_name,
			url, secure_url, bytes, format, original_name, created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
	`, record.RecordID, record.UserID, record.BotID, record.BotToken, record.BotName, record.BotUsername, record.FileID, record.ChatID, record.ChatTitle, record.ChatType, record.FolderName, record.URL, record.SecureURL, int64(record.Bytes), record.Format, record.OriginalName, record.CreatedAt, record.UpdatedAt); err != nil {
		return models.FileRecord{}, err
	}

	return record, nil
}

func (s *Store) UpdateFile(userID, fileID string, req models.FileRecordUpdateRequest) (models.FileRecord, bool, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return models.FileRecord{}, false, err
	}
	defer tx.Rollback()

	var file models.FileRecord
	var bytesValue int64
	if err := tx.QueryRowContext(ctx, `
		SELECT record_id, user_id, bot_id, bot_token, COALESCE(bot_name, ''), COALESCE(bot_username, ''), file_id, chat_id,
			COALESCE(chat_title, ''), COALESCE(chat_type, ''), COALESCE(folder_name, ''), url, secure_url, bytes, COALESCE(format, ''), COALESCE(original_name, ''), created_at, updated_at
		FROM files
		WHERE user_id = $1 AND record_id = $2
	`, userID, fileID).Scan(&file.RecordID, &file.UserID, &file.BotID, &file.BotToken, &file.BotName, &file.BotUsername, &file.FileID, &file.ChatID, &file.ChatTitle, &file.ChatType, &file.FolderName, &file.URL, &file.SecureURL, &bytesValue, &file.Format, &file.OriginalName, &file.CreatedAt, &file.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.FileRecord{}, false, nil
		}
		return models.FileRecord{}, false, err
	}
	file.Bytes = int(bytesValue)

	if req.ChatID != nil {
		newChatID := strings.TrimSpace(*req.ChatID)
		file.ChatID = newChatID
		if chat, found := s.findChatTx(ctx, tx, userID, file.BotID, newChatID); found {
			file.ChatTitle = chat.Title
			file.ChatType = chat.Type
		}
	}
	if req.OriginalName != nil {
		file.OriginalName = strings.TrimSpace(*req.OriginalName)
	}
	if req.FolderName != nil {
		file.FolderName = strings.TrimSpace(*req.FolderName)
	}
	file.UpdatedAt = time.Now().UTC()

	if _, err := tx.ExecContext(ctx, `
		UPDATE files
		SET chat_id = $1, chat_title = $2, chat_type = $3, folder_name = $4, original_name = $5, updated_at = $6
		WHERE user_id = $7 AND record_id = $8
	`, file.ChatID, file.ChatTitle, file.ChatType, file.FolderName, file.OriginalName, file.UpdatedAt, userID, fileID); err != nil {
		return models.FileRecord{}, false, err
	}

	if err := tx.Commit(); err != nil {
		return models.FileRecord{}, false, err
	}

	return file, true, nil
}

func (s *Store) DeleteFile(userID, fileID string) bool {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	result, err := s.db.ExecContext(ctx, `
		DELETE FROM files WHERE user_id = $1 AND record_id = $2
	`, userID, fileID)
	if err != nil {
		return false
	}
	rows, err := result.RowsAffected()
	if err != nil {
		return false
	}

	return rows > 0
}

func (s *Store) ResolveDownloadURL(encrypted string) (string, error) {
	botToken, fileID, err := utils.DecryptFileInfo(encrypted)
	if err != nil {
		return "", err
	}

	telegramRepo := repositories.NewFileRepository()
	fileURL, _, err := telegramRepo.GetFileInfo(botToken, fileID)
	if err != nil {
		return "", err
	}

	return fileURL, nil
}

func (s *Store) findBotTx(ctx context.Context, tx *sql.Tx, userID, botID string) (models.Bot, bool) {
	var bot models.Bot
	if err := tx.QueryRowContext(ctx, `
		SELECT id, user_id, name, token, COALESCE(username, ''), COALESCE(first_name, ''), COALESCE(active_chat_id, ''), created_at, updated_at
		FROM bots
		WHERE id = $1 AND user_id = $2
	`, botID, userID).Scan(&bot.ID, &bot.UserID, &bot.Name, &bot.Token, &bot.Username, &bot.FirstName, &bot.ActiveChatID, &bot.CreatedAt, &bot.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.Bot{}, false
		}
		return models.Bot{}, false
	}

	return bot, true
}

func (s *Store) findChatTx(ctx context.Context, tx *sql.Tx, userID, botID, chatID string) (models.Chat, bool) {
	var chat models.Chat
	if err := tx.QueryRowContext(ctx, `
		SELECT id, user_id, bot_id, chat_id, COALESCE(title, ''), COALESCE(type, ''), created_at, updated_at
		FROM chats
		WHERE user_id = $1 AND bot_id = $2 AND chat_id = $3
	`, userID, botID, chatID).Scan(&chat.ID, &chat.UserID, &chat.BotID, &chat.ChatID, &chat.Title, &chat.Type, &chat.CreatedAt, &chat.UpdatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return models.Chat{}, false
		}
		return models.Chat{}, false
	}

	return chat, true
}

func (s *Store) ListBotsForDebug(userID string) []models.Bot {
	bots := s.ListBots(userID)
	sort.Slice(bots, func(i, j int) bool {
		return bots[i].CreatedAt.After(bots[j].CreatedAt)
	})
	return bots
}

func (s *Store) CountChats(userID, botID string) int {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var count int
	_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM chats WHERE user_id = $1 AND bot_id = $2`, userID, botID).Scan(&count)
	return count
}

func parseInt64(value string) int64 {
	parsed, _ := strconv.ParseInt(value, 10, 64)
	return parsed
}

func (s *Store) UpdateUserTheme(userID string, theme string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	_, err := s.db.ExecContext(ctx, `
		UPDATE users
		SET theme = $1, updated_at = NOW()
		WHERE id = $2
	`, theme, userID)
	return err
}
