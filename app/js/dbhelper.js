/**
 * Common database helper functions.
 */

import idb from 'idb';

const dbPromise = idb.open('udacity-restaurant', 4, upgradeDB => {
  switch (upgradeDB.oldVersion) {
    case 0:
      upgradeDB.createObjectStore('restaurants', {keyPath: 'id'});
      break;
    case 1:
      upgradeDB.createObjectStore('pending', {
        keyPath: 'id',
        autoIncrement: true
      });
  }
});

class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337 // Change this to your server port
    return `http://localhost:${port}/restaurants`
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback, restaurantID) {
    let restaurantURL;

    if (!restaurantID) {
      restaurantURL = DBHelper.DATABASE_URL
    }
    else {
      restaurantURL = DBHelper.DATABASE_URL + '/' + restaurantID
    }
    fetch(restaurantURL, { method: 'GET' })
      .then(response => {
        response.json().then(restaurants => {
          // console.log('Return restaurants JSON: ' + restaurants)
          callback(null, restaurants)
        })
      })
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    // fetch all restaurants with proper error handling.
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null)
      } else {
        const restaurant = restaurants.find(r => r.id == id)
        if (restaurant) { // Got the restaurant
          callback(null, restaurant)
        } else { // Restaurant does not exist in the database
          callback('Restaurant does not exist', null)
        }
      }
    })
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null)
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine)
        callback(null, results)
      }
    })
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null)
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood)
        callback(null, results)
      }
    })
  }

  /**
   * Fetch restaurants by a cuisine and a neighborhood with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null)
      } else {
        let results = restaurants
        if (cuisine !== 'all') { // filter by cuisine
          results = results.filter(r => r.cuisine_type == cuisine)
        }
        if (neighborhood !== 'all') { // filter by neighborhood
          results = results.filter(r => r.neighborhood == neighborhood)
        }
        callback(null, results)
      }
    })
  }

  /**
   * Fetch all neighborhoods with proper error handling.
   */
  static fetchNeighborhoods(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null)
      } else {
        // Get all neighborhoods from all restaurants
        const neighborhoods = restaurants.map((v, i) => restaurants[i].neighborhood)
        // Remove duplicates from neighborhoods
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
        callback(null, uniqueNeighborhoods)
      }
    })
  }

  /**
   * Fetch all cuisines with proper error handling.
   */
  static fetchCuisines(callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        callback(error, null)
      } else {
        // Get all cuisines from all restaurants
        const cuisines = restaurants.map((v, i) => restaurants[i].cuisine_type)
        // Remove duplicates from cuisines
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)
        callback(null, uniqueCuisines)
      }
    })
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`)
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    console.log(restaurant);
    return (`/img/${restaurant.photograph}.jpg`)
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    const marker = new google.maps.Marker({
        position: restaurant.latlng,
        title: restaurant.name,
        url: DBHelper.urlForRestaurant(restaurant),
        map: map,
        animation: google.maps.Animation.DROP
      }
    )
    return marker
  }

  static handleFavClick(id, newState) {
    // Block any more clicks on this until the callback
    const fav = document.getElementById('favorite-icon-' + id);
    fav.onclick = null;

    DBHelper.updateFavorite(id, newState, (error, resultObj) => {
      if (error) {
        console.log('Error updating favorite');
        return;
      }
      // Update the button background for the specified favorite
      const favorite = document.getElementById('favorite-icon-' + resultObj.id);
      favorite.style.background = resultObj.value
        ? `url('/icons/outline-favorite-24px.svg') no-repeat`
        : `url('/icons/outline-favorite_border-24px.svg') no-repeat`;
    });
  }

  static updateFavorite(id, newState, callback) {
    // Push the request into the waiting queue in IDB
    const url = `${DBHelper.DATABASE_URL}/${id}/?is_favorite=${newState}`;
    const method = 'PUT';
    DBHelper.updateCachedRestaurantData(id, {'is_favorite': newState});
    DBHelper.addPendingRequestToQueue(url, method);

    // Update the favorite data on the selected ID in the cached data

    callback(null, {id, value: newState});
  }

  static updateCachedRestaurantData(id, updateObj) {
    console.log('in updateCachedRestaurantData');
    const dbPromise = idb.open('udacity-restaurant');
    // Update in the data for all restaurants first
    dbPromise.then(db => {
      console.log('Getting db transaction');
      const tx = db.transaction('restaurants', 'readwrite');
      const value = tx
        .objectStore('restaurants')
        .get('-1')
        .then(value => {
          if (!value) {
            console.log('No cached data found');
            return;
          }
          const data = value.data;
          const restaurantArr = data.filter(r => r.id === id);
          const restaurantObj = restaurantArr[0];
          // Update restaurantObj with updateObj details
          if (!restaurantObj)
            return;
          const keys = Object.keys(updateObj);
          keys.forEach(k => {
            restaurantObj[k] = updateObj[k];
          })

          // Put the data back in IDB storage
          dbPromise.then(db => {
            const tx = db.transaction('restaurants', 'readwrite');
            tx
              .objectStore('restaurants')
              .put({id: '-1', data: data});
            return tx.complete;
          })
        })
    })

    // Update the restaurant specific data
    dbPromise.then(db => {
      console.log('Getting db transaction');
      const tx = db.transaction('restaurants', 'readwrite');
      const value = tx
        .objectStore('restaurants')
        .get(id + '')
        .then(value => {
          if (!value) {
            console.log('No cached data found');
            return;
          }
          const restaurantObj = value.data;
          console.log('Specific restaurant obj: ', restaurantObj);
          // Update restaurantObj with updateObj details
          if (!restaurantObj)
            return;
          const keys = Object.keys(updateObj);
          keys.forEach(k => {
            restaurantObj[k] = updateObj[k];
          })

          // Put the data back in IDB storage
          dbPromise.then(db => {
            const tx = db.transaction('restaurants', 'readwrite');
            tx
              .objectStore('restaurants')
              .put({
                id: id + '',
                data: restaurantObj
              });
            return tx.complete;
          })
        })
    })
  }

  static addPendingRequestToQueue(url, method, body) {
    // Open the database ad add the request details to the pending table
    const dbPromise = idb.open('udacity-restaurant');
    dbPromise.then(db => {
      const tx = db.transaction('pending', 'readwrite');
      tx
        .objectStore('pending')
        .put({
          data: {
            url,
            method,
            body
          }
        })
    })
      .catch(error => {})
      .then(DBHelper.nextPending());
  }

  static nextPending() {
    DBHelper.attemptCommitPending(DBHelper.nextPending);
  }

  static attemptCommitPending(callback) {
    // Iterate over the pending items until there is a network failure
    let url;
    let method;
    let body;
    //const dbPromise = idb.open('fm-udacity-restaurant');
    dbPromise.then(db => {
      if (!db.objectStoreNames.length) {
        console.log('DB not available');
        db.close();
        return;
      }

      const tx = db.transaction('pending', 'readwrite');
      tx
        .objectStore('pending')
        .openCursor()
        .then(cursor => {
          if (!cursor) {
            return;
          }
          const value = cursor.value;
          url = cursor.value.data.url;
          method = cursor.value.data.method;
          body = cursor.value.data.body;

          // If we don't have a parameter then we're on a bad record that should be tossed
          // and then move on
          if ((!url || !method) || (method === 'POST' && !body)) {
            cursor
              .delete()
              .then(callback());
            return;
          };

          const properties = {
            body: JSON.stringify(body),
            method: method
          }
          console.log('sending post from queue: ', properties);
          fetch(url, properties)
            .then(response => {
              // If we don't get a good response then assume we're offline
              if (!response.ok && !response.redirected) {
                return;
              }
            })
            .then(() => {
              // Success! Delete the item from the pending queue
              const deltx = db.transaction('pending', 'readwrite');
              deltx
                .objectStore('pending')
                .openCursor()
                .then(cursor => {
                  cursor
                    .delete()
                    .then(() => {
                      callback();
                    })
                })
              console.log('deleted pending item from queue');
            })
        })
        .catch(error => {
          console.log('Error reading cursor');
          return;
        })
    })
  }

}

window.DBHelper = DBHelper;
