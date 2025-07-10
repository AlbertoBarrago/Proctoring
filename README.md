# AI-Proctoring Backend

## Project Overview

This project provides the backend infrastructure for a web-based proctoring application. Its primary function is to monitor students during online examinations by processing real-time data from webcams and microphones, thereby ensuring academic integrity.

## Features

*   **Real-time Monitoring:** Captures and processes webcam and microphone data during online exams.
*   **Behavioral Analysis:** Detects unusual patterns or suspicious activities through audio and video analysis.
*   **Secure Data Handling:** Manages and stores collected proctoring data securely for review and auditing purposes.
*   **Scalable Architecture:** Designed to handle multiple concurrent proctoring sessions efficiently.

## Technologies Used

### Backend
*   **PHP:** Core programming language.
*   **Laravel:** Web application framework for robust API development.
*   **Composer:** Dependency management for PHP.

### Frontend (Refer to `proctoring-frontend/README.md` for details)
*   **JavaScript, TypeScript, HTML, CSS:** Core web technologies.
*   **Vite:** Frontend build tool.
*   **Tailwind CSS:** Utility-first CSS framework.
*   **Axios:** Promise-based HTTP client.
*   **ONNX Runtime Web:** For client-side AI model inference (e.g., `onnxruntime-web: ^1.22.0`).

## Installation

To set up the project locally, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/AI-Proctoring.git # Replace with your actual repository URL
    cd AI-Proctoring
    ```

2.  **Install PHP Dependencies:**
    ```bash
    composer install
    ```

3.  **Install Node.js Dependencies (for frontend assets):**
    ```bash
    npm install
    ```

4.  **Environment Configuration:**
    Copy the example environment file and generate an application key:
    ```bash
    cp .env.example .env
    php artisan key:generate
    ```
    Edit the `.env` file to configure your database connection and other settings. Ensure `DB_DATABASE` is set to `proctoring_db` or your preferred database name.

5.  **Database Setup:**
    Create a new database named `proctoring_db` (or as configured in `.env`). Then, run migrations to set up the database tables:
    ```bash
    php artisan migrate
    ```

6.  **Build Frontend Assets:**
    For development:
    ```bash
    npm run dev
    ```
    For production:
    ```bash
    npm run build
    ```

## Usage

### Starting the Backend Server

To start the Laravel development server:
```bash
php artisan serve
```
The API will typically be accessible at `http://127.0.0.1:8000`.

### Running the Frontend

Navigate to the `proctoring-frontend` directory and follow its `README.md` instructions to run the frontend application. The frontend is typically served on `http://localhost:4200`.

## Project Structure

```
.
├── README.md                 # Project documentation
├── app/                      # Laravel application core (Models, Controllers, Providers, etc.)
├── bootstrap/                # Framework bootstrapping
├── config/                   # Configuration files
├── database/                 # Database migrations, seeders, and factories
├── public/                   # Web server entry point
├── resources/                # Frontend assets (CSS, JS) and Blade templates
├── routes/                   # API and web routes
├── storage/                  # Application generated files (logs, cache, sessions)
├── tests/                    # Automated tests
├── vendor/                   # Composer dependencies
├── proctoring-frontend/      # Separate directory for the frontend application
│   ├── src/                  # Frontend source code (Angular, TypeScript, etc.)
│   ├── public/               # Frontend public assets
│   └── ...
├── composer.json             # PHP dependencies
├── package.json              # Node.js dependencies and scripts
├── vite.config.js            # Vite configuration
└── ...
```

## Contributing

We welcome contributions to this project! To contribute, please follow these steps:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and commit them with clear, descriptive messages.
4.  Submit a pull request.

Please ensure that your code adheres to the project's coding style and includes appropriate unit tests.

## License

This project is licensed under the Apache License 2.0. See the [LICENSE](LICENSE) file for details.
