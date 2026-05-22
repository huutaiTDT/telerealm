package api

import (
	"fmt"
	"io"
	"strings"

	"telerealm/models"
	"telerealm/repositories"
	"telerealm/utils"

	"github.com/google/uuid"
)

type Service struct {
	store    *Store
	telegram repositories.FileRepository
}

func NewService(store *Store, telegram repositories.FileRepository) *Service {
	return &Service{store: store, telegram: telegram}
}

func (s *Service) Register(req models.RegisterRequest) (models.User, string, error) {
	return s.store.RegisterUser(req)
}

func (s *Service) Login(req models.LoginRequest) (models.User, string, error) {
	return s.store.LoginUser(req.Email, req.Password)
}

func (s *Service) Me(sessionToken string) (models.User, bool) {
	return s.store.GetUserBySession(sessionToken)
}

func (s *Service) CreateBot(userID string, req models.BotCreateRequest) (models.Bot, []models.Chat, error) {
	name := strings.TrimSpace(req.Name)
	token := strings.TrimSpace(req.Token)
	if name == "" {
		name = "Telegram Bot"
	}
	if token == "" {
		return models.Bot{}, nil, fmt.Errorf("bot token is required")
	}

	botInfo, err := s.telegram.GetBotInfo(token)
	if err != nil {
		return models.Bot{}, nil, err
	}

	bot := models.Bot{
		Name:      name,
		Token:     token,
		Username:  stringFromMap(botInfo, "username"),
		FirstName: stringFromMap(botInfo, "first_name"),
	}
	createdBot, err := s.store.CreateBot(userID, bot)
	if err != nil {
		return models.Bot{}, nil, err
	}

	chats, syncErr := s.SyncChats(userID, createdBot.ID)
	if syncErr != nil {
		return createdBot, nil, syncErr
	}

	return createdBot, chats, nil
}

func (s *Service) ListBots(userID string) []models.Bot {
	return s.store.ListBots(userID)
}

func (s *Service) SyncChats(userID, botID string) ([]models.Chat, error) {
	bot, found := s.store.GetBot(userID, botID)
	if !found {
		return nil, fmt.Errorf("bot not found")
	}

	chatSummaries, err := s.telegram.ListRecentChats(bot.Token)
	if err != nil {
		return nil, err
	}

	return s.store.UpsertChats(userID, botID, chatSummaries)
}

func (s *Service) ListChats(userID, botID string) ([]models.Chat, error) {
	if _, found := s.store.GetBot(userID, botID); !found {
		return nil, fmt.Errorf("bot not found")
	}

	return s.store.ListChats(userID, botID), nil
}

func (s *Service) SelectChat(userID, botID, chatID string) (models.Chat, error) {
	return s.store.SelectChat(userID, botID, chatID)
}

func (s *Service) ListFiles(userID, botID, chatID string) []models.FileRecord {
	return s.store.ListFiles(userID, botID, chatID)
}

// CountFiles returns the total number of files for a chat (or bot).
func (s *Service) CountFiles(userID, botID, chatID string) (int, error) {
    return s.store.CountFiles(userID, botID, chatID)
}

// ListFilesPaginated returns a slice of FileRecord with pagination support.
func (s *Service) ListFilesPaginated(userID, botID, chatID string, offset, limit int) ([]models.FileRecord, error) {
    return s.store.ListFilesPaginated(userID, botID, chatID, offset, limit)
}


func (s *Service) CreateFile(userID, botID, chatID string, file io.Reader, fileName string, folderName string) (models.FileRecord, error) {
	bot, found := s.store.GetBot(userID, botID)
	if !found {
		return models.FileRecord{}, fmt.Errorf("bot not found")
	}

	chat, err := s.store.SelectChat(userID, botID, chatID)
	if err != nil {
		return models.FileRecord{}, err
	}

	fileID, err := s.telegram.SendDocument(bot.Token, chat.ChatID, file, fileName)
	if err != nil {
		return models.FileRecord{}, err
	}

	fileURL, fileSize, err := s.telegram.GetFileInfo(bot.Token, fileID)
	if err != nil {
		return models.FileRecord{}, err
	}

	secureURL, err := utils.EncryptFileInfo(bot.Token, fileID)
	if err != nil {
		return models.FileRecord{}, err
	}

	fileExt := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(fileExtension(fileName))), ".")
	record := models.FileRecord{
		RecordID:     uuid.NewString(),
		UserID:       userID,
		BotID:        bot.ID,
		BotName:      bot.Name,
		BotUsername:  bot.Username,
		BotToken:     bot.Token,
		FileID:       fileID,
		ChatID:       chat.ChatID,
		ChatTitle:    chat.Title,
		ChatType:     chat.Type,
		FolderName:   strings.TrimSpace(folderName),
		URL:          fileURL,
		SecureURL:    "/drive/" + secureURL,
		Bytes:        fileSize,
		Format:       fileExt,
		OriginalName: fileName,
	}

	return s.store.CreateFileRecord(record)
}

func (s *Service) GetFile(userID, fileID string) (models.FileRecord, error) {
	record, found := s.store.GetFile(userID, fileID)
	if !found {
		return models.FileRecord{}, fmt.Errorf("file record not found")
	}

	return record, nil
}

func (s *Service) UpdateFile(userID, fileID string, req models.FileRecordUpdateRequest) (models.FileRecord, error) {
	record, found, err := s.store.UpdateFile(userID, fileID, req)
	if err != nil {
		return models.FileRecord{}, err
	}
	if !found {
		return models.FileRecord{}, fmt.Errorf("file record not found")
	}

	return record, nil
}

func (s *Service) DeleteFile(userID, fileID string) error {
	if !s.store.DeleteFile(userID, fileID) {
		return fmt.Errorf("file record not found")
	}

	return nil
}

func (s *Service) ResolveDownload(encrypted string) (string, error) {
	return s.store.ResolveDownloadURL(encrypted)
}

func (s *Service) UpdateUserTheme(userID string, theme string) error {
	return s.store.UpdateUserTheme(userID, theme)
}

func fileExtension(name string) string {
	idx := strings.LastIndex(name, ".")
	if idx == -1 {
		return ""
	}

	return name[idx:]
}

func stringFromMap(values map[string]interface{}, key string) string {
	value, ok := values[key]
	if !ok || value == nil {
		return ""
	}
	if text, ok := value.(string); ok {
		return text
	}
	return fmt.Sprintf("%v", value)
}
