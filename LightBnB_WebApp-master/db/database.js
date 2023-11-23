const properties = require("./json/properties.json");
const users = require("./json/users.json");
const { Pool } = require('pg');

// Establishing connection to PostgreSQL
const pool = new Pool({
  user: 'vagrant',
  password: '123',
  host: 'localhost',
  database: 'lightbnb'
});

// Users

/**
 * Retrieve a single user from the database based on their email.
 * @param {String} email - The email of the user.
 * @return {Promise<{}>} A promise representing the user.
 */
const getUserWithEmail = function (email) {
  const query = `
    SELECT *
    FROM users
    WHERE email = $1;
  `;

  return pool
    .query(query, [email])
    .then((result) => result.rows[0] || null)
    .catch((err) => {
      console.error(err.message);
      throw err;
    });
};

/**
 * Retrieve a single user from the database based on their id.
 * @param {string} id - The id of the user.
 * @return {Promise<{}>} A promise representing the user.
 */
const getUserWithId = function (id) {
  const query = `
    SELECT *
    FROM users
    WHERE id = $1;
  `;

  return pool
    .query(query, [id])
    .then((result) => result.rows[0] || null)
    .catch((err) => {
      console.error(err.message);
      throw err;
    });
};

/**
 * Add a new user to the database.
 * @param {{name: string, password: string, email: string}} user - The user details.
 * @return {Promise<{}>} A promise representing the new user.
 */
const addUser = function (user) {
  const query = `
    INSERT INTO users (name, email, password)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;

  const values = [user.name, user.email, user.password];

  return pool
    .query(query, values)
    .then((result) => result.rows[0])
    .catch((err) => {
      console.error(err.message);
      throw err;
    });
};

// Reservations

/**
 * Get all reservations for a single user.
 * @param {string} guest_id - The id of the user.
 * @param {number} limit - The maximum number of reservations to retrieve.
 * @return {Promise<[{}]>} A promise representing the reservations.
 */
const getAllReservations = function (guest_id, limit = 10) {
  const query = `
    SELECT reservations.id, properties.*, reservations.start_date, reservations.end_date, AVG(property_reviews.rating) AS average_rating
    FROM reservations
    JOIN properties ON reservations.property_id = properties.id
    LEFT JOIN property_reviews ON properties.id = property_reviews.property_id
    WHERE reservations.guest_id = $1
    GROUP BY reservations.id, properties.id
    ORDER BY reservations.start_date
    LIMIT $2;
  `;

  return pool
    .query(query, [guest_id, limit])
    .then((result) => result.rows)
    .catch((err) => {
      console.error(err.message);
      throw err;
    });
};

// Properties

/**
 * Get all properties based on specified options.
 * @param {{}} options - An object containing query options.
 * @param {number} limit - The number of results to return.
 * @return {Promise<[{}]>} A promise representing the properties.
 */
const getAllProperties = function (options, limit = 10) {
  const queryParams = [];
  let queryString = `
    SELECT properties.*, property_reviews_average.rating_avg
    FROM properties
    LEFT JOIN (
      SELECT property_id, AVG(rating) AS rating_avg
      FROM property_reviews
      GROUP BY property_id
    ) AS property_reviews_average ON properties.id = property_reviews_average.property_id
  `;

  // Check if any filters are provided
  if (
    options.owner_id ||
    options.city ||
    (options.minimum_price_per_night && options.maximum_price_per_night) ||
    options.minimum_rating
  ) {
    queryString += 'WHERE';

    // Check if owner_id is provided
    if (options.owner_id) {
      queryParams.push(options.owner_id);
      queryString += ` owner_id = $${queryParams.length} AND `;
    }

    // Check if city is provided
    if (options.city) {
      queryParams.push(`%${options.city}%`);
      queryString += ` city LIKE $${queryParams.length} AND `;
    }

    // Check if price range is provided
    if (options.minimum_price_per_night && options.maximum_price_per_night) {
      queryParams.push(options.minimum_price_per_night * 100); // Convert to cents
      queryParams.push(options.maximum_price_per_night * 100); // Convert to cents
      queryString += ` cost_per_night BETWEEN $${queryParams.length - 1} AND $${queryParams.length} AND `;
    }

    // Check if minimum rating is provided
    if (options.minimum_rating) {
      queryParams.push(options.minimum_rating);
      queryString += ` property_reviews_average.rating_avg >= $${queryParams.length} AND `;
    }

    // Remove the trailing "AND"
    queryString = queryString.slice(0, -5);
  }

  queryParams.push(limit);
  queryString += `
    GROUP BY properties.id, property_reviews_average.rating_avg
    ORDER BY cost_per_night
    LIMIT $${queryParams.length};
  `;

  return pool.query(queryString, queryParams).then((result) => result.rows);
};

/**
 * Add a property to the database.
 * @param {{}} property - An object containing all of the property details.
 * @return {Promise<{}>} A promise representing the added property.
 */
const addProperty = function (property) {
  const queryParams = [
    property.owner_id,
    property.title,
    property.description,
    property.thumbnail_photo_url,
    property.cover_photo_url,
    property.cost_per_night,
    property.street,
    property.city,
    property.province,
    property.post_code,
    property.country,
    property.parking_spaces,
    property.number_of_bathrooms,
    property.number_of_bedrooms
  ];

  const queryString = `
    INSERT INTO properties (
      owner_id,
      title,
      description,
      thumbnail_photo_url,
      cover_photo_url,
      cost_per_night,
      street,
      city,
      province,
      post_code,
      country,
      parking_spaces,
      number_of_bathrooms,
      number_of_bedrooms
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    RETURNING *;
  `;

  return pool
    .query(queryString, queryParams)
    .then((result) => result.rows[0])
    .catch((err) => console.error('Error executing query', err));
};

module.exports = {
  getUserWithEmail,
  getUserWithId,
  addUser,
  getAllReservations,
  getAllProperties,
  addProperty,
};
