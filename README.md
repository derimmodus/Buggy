# Docker-Ready HelpTool

Ein schlankes Flask-basiertes HelpTool für Docker-Umgebungen.

## Schnellstart

```bash
# Starten
docker-compose up -d

# Stoppen
docker-compose down
```

## Zugriff

Nach dem Start ist die Anwendung unter `http://localhost:5411` verfügbar.
├── app/                    # Python backend application
│   ├── api/               # API endpoints
│   ├── core/              # Core functionality
│   ├── models/            # Data models
│   ├── services/          # Business logic
│   └── utils/             # Utility functions
├── static/                # Static web assets
│   ├── css/               # Stylesheets
│   ├── js/                # JavaScript files
│   └── *.html             # HTML templates
├── data/                  # JSON data storage
├── logs/                  # Application logs
├── tests/                 # Test files
├── docs/                  # Documentation
└── docker/                # Docker-related files
```

## API Endpoints

- `GET/POST /api/<module>` - CRUD operations for different modules
- `GET/POST /api/<module>/<id>` - Individual item operations

Available modules: tickets, contacts, network_devices, etc.

## Configuration

The application uses JSON files for data storage located in the `data/` directory. Configuration can be modified through the web interface or by editing the JSON files directly.

## Docker Commands

```bash
# Build the image
docker-compose build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down

# Rebuild after changes
docker-compose up --build --force-recreate
```

## Health Check

The application includes a health check endpoint at `/api/system/info` that can be used for monitoring.

## Contributing

1. Make changes to the codebase
2. Test locally
3. Ensure Docker build works
4. Submit a pull request

## License

This project is proprietary software.
