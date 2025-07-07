# AI-Proctoring

## Project Description

> This project is a web-based proctoring application designed to monitor students during online exams. It uses webcam and microphone access to detect potentially suspicious behavior and ensure academic integrity.

## Features and Capabilities

*   **Real-time Webcam Monitoring:** Records student video during the exam.
*   **Audio Analysis:** Detects unusual sounds or voices in the exam environment.
*   **Screen Recording:** Optionally records the student's screen activity.
*   **Data Storage:** Securely stores collected data for review.

## Technologies Used

*   JavaScript
*   HTML
*   TypeScript
*   CSS
*   onnxruntime-web: ^1.22.0
*   Vite
*   Tailwind CSS
*   Laravel Vite Plugin
*   Axios

## Installation

1.  **Clone the repository:**

    ```bash
    git clone [Your Repository URL]
    cd [Project Directory Name]
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Configure environment variables:**

    Example:

    > Copy `.env.example` to `.env` and update the values with your specific configuration.

    ```bash
    cp .env.example .env
    ```

4.  **Build the assets (if necessary):**

    ```bash
    npm run build
    ```
    or
    ```bash
    npm run dev # For development
    ```
## DB 
Create a new DB `proctoring_db` and add the Table.

## Server

1. *Start the Laravel API server*
    ```bash 
    php artisan serve
    ```

## Usage

1.  **Start the development server (if applicable):**

    ```bash
    npm run start
    ```

2.  **Access the application in your browser:**

    `http://localhost:4200`


## Project Structure

```
[Project Directory Name]/
├── README.md
├── composer.json
├── package-lock.json
├── package.json
├── vite.config.js
├── proctoring-frontend/  # Likely contains the frontend code
│   ├── [Add key files and directories within this folder]
├── resources/         # Likely contains assets, views, or other resources
│   ├── [Add key files and directories within this folder]
└── ...
```

*   **`README.md`:** This file (project documentation).
*   **`composer.json`:** PHP dependencies (Likely backend component)
*   **`package.json`:** Node.js dependencies and scripts.
*   **`vite.config.js`:** Vite configuration file.
*   **`proctoring-frontend/`:** Contains the frontend code, likely built with JavaScript, TypeScript, HTML, and CSS.
*   **`resources/`:** Contains assets, views, or other resources used by the application.  This directory's content will vary significantly depending on the specific implementation.

## Contributing

Example:

> We welcome contributions to this project! To contribute, please follow these steps:
>
> 1.  Fork the repository.
> 2.  Create a new branch for your feature or bug fix.
> 3.  Make your changes and commit them with clear, descriptive messages.
> 4.  Submit a pull request.
>
> Please ensure that your code adheres to the project's coding style and includes appropriate unit tests.

## License

> This project is licensed under the ABCL-2025. see the [LICENSE](LICENSE) file for details.
