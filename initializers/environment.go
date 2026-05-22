package initializers

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

func LoadEnvironment() {
	if os.Getenv("GIN_MODE") != "release" {
		if err := godotenv.Load(); err != nil {
			log.Println("Error loading .env file")
		} else {
			log.Println("Loaded .env file")
		}
 	}
}
