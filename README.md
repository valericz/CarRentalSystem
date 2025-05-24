# Car Rental Web Application

A simple web application for car rental services built with Node.js, Express, and vanilla JavaScript.

## Features

- Browse available cars
- Search cars by brand, model, or features
- Make car reservations
- Responsive design
- Form validation
- RESTful API endpoints

## Project Structure

```
car-rental/
├── server.js              # Express server
├── package.json           # Project configuration
├── public/                # Frontend files
│   ├── index.html         # Homepage
│   ├── reservation.html   # Reservation page
│   ├── css/
│   │   └── style.css      # Styles
│   ├── js/
│   │   ├── main.js        # Main functionality
│   │   ├── search.js      # Search functionality
│   │   └── reservation.js # Reservation handling
│   └── images/            # Car images
├── data/
│   ├── cars.json          # Car data
│   └── orders.json        # Order data
└── README.md              # Project documentation
```

## Setup and Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. For development with auto-reload:
   ```bash
   npm run dev
   ```

## API Endpoints

- `GET /api/cars` - Get all available cars
- `POST /api/orders` - Create a new reservation

## Technologies Used

- Node.js
- Express.js
- Vanilla JavaScript
- HTML5
- CSS3

## License

MIT 