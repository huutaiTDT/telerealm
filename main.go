package main

import (
	"log"

	"telerealm/api"
	"telerealm/initializers"
)

func main() {
	initializers.LoadEnvironment()

	server, err := api.NewRouter()
	if err != nil {
		log.Fatal(err)
	}

	if err := server.Run(":7777"); err != nil {
		log.Fatal(err)
	}
}
