import idb from 'idb'

var cacheID = 'mws-restaurant-002'

const dbPromise = idb.open('udacity-restaurant', 4, upgradeDB => {
  switch (upgradeDB.oldVersion) {
    case 0:
      upgradeDB.createObjectStore('restaurants', { keyPath: 'id' })
    case 1: {
      const reviewsStore = upgradeDB.createObjectStore('reviews', { keyPath: 'id' })
      reviewsStore.createIndex('restaurant_id', 'restaurant_id')
    }
    case 2:
      upgradeDB.createObjectStore('pending', {
        keyPath: 'id',
        autoIncrement: true
      })
  }
})

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheID).then(cache => {
    return cache
      .addAll([
        '/',
        '/index.html',
        '/restaurant.html',
        '/js/main.js',
        '/js/dbhelper.js',
        '/js/restaurant_info.js',
        '/js/review.js',
        '/review.html',
        '/css/styles.css',
        '/img/undefined.jpg',
        '/js/swController.js'
      ])
      .catch(error => {
        console.log('Caches open failed: ' + error)
      })
  }))
})

//
// self.addEventListener('activate', function (event) {
//   console.log('in activate')
//   event.waitUntil(
//     caches.keys().then(function (cacheNames) {
//       return Promise.all(
//         cacheNames.filter(function (cacheName) {
//           return cacheName.startsWith('restaurant-') &&
//             cacheName != CACHE_NAME
//         }).map(function (cacheName) {
//           return caches.delete(cacheName)
//         })
//       )
//     })
//   )
// })

self.addEventListener('fetch', function (event) {
  console.log('fetching...')

  let cacheRequest = event.request
  let cacheUrlObj = new URL(event.request.url)
  if (event.request.url.indexOf('restaurant.html') > -1) {
    const cacheURL = 'restaurant.html'
    cacheRequest = new Request(cacheURL)
  }

  const URLCheck = new URL(event.request.url)
  if (URLCheck.port === '1337') {
    const parts = URLCheck.pathname.split('/')
    let id = URLCheck
      .searchParams
      .get('restaurant_id') - 0
    if (!id) {
      if (URLCheck.pathname.indexOf('restaurants')) {
        id = parts[parts.length - 1] === 'restaurants'
          ? '-1'
          : parts[parts.length - 1]
      } else {
        id = URLCheck
          .searchParams
          .get('id')
      }
    }
    console.log('THE ID IS' + id)
    handleAJAXEvent(event, id)
  } else {
    cacheResponse(event, cacheRequest)
  }
})

const handleAJAXEvent = (event, id) => {
  console.log("IN handleAJAXEvent")
  // Only use caching for GET events
  if (event.request.method !== 'GET') {
    return fetch(event.request)
      .then(fetchResponse => fetchResponse.json())
      .then(json => {
        return json
      })
  }

  // Split these request for handling restaurants vs reviews
  if (event.request.url.indexOf('reviews') > -1) {
    handleReviewsEvent(event, id)
  } else {
    handleRestaurantEvent(event, id)
  }
}

const handleRestaurantEvent = (event, id) => {
  event.respondWith(dbPromise.then(db => {
    return db
      .transaction('restaurants')
      .objectStore('restaurants')
      .get(id)
  }).then(data => {
    return (data && data.data) || fetch(event.request)
      .then(fetchResponse => fetchResponse.json())
      .then(json => {
        return dbPromise.then(db => {
          const tx = db.transaction('restaurants', 'readwrite')
          const store = tx.objectStore('restaurants')
          store.put({ id: id, data: json })
          return json
        })
      })
  }).then(finalResponse => {
    return new Response(JSON.stringify(finalResponse))
  }).catch(error => {
    return new Response('Error fetching data', { status: 500 } + error)
  }))
}

const handleReviewsEvent = (event, id) => {
  event.respondWith(dbPromise.then(db => {
    return db
      .transaction('reviews')
      .objectStore('reviews')
      .index('restaurant_id')
      .getAll(id)
  }).then(data => {
    return (data.length && data) || fetch(event.request)
      .then(fetchResponse => fetchResponse.json())
      .then(data => {
        return dbPromise.then(idb => {
          const itx = idb.transaction('reviews', 'readwrite')
          const store = itx.objectStore('reviews')
          data.forEach(review => {
            store.put({ id: review.id, 'restaurant_id': review['restaurant_id'], data: review })
          })
          return data
        })
      })
  }).then(finalResponse => {
    if (finalResponse[0].data) {
      // Need to transform the data to the proper format
      const mapResponse = finalResponse.map(review => review.data)
      return new Response(JSON.stringify(mapResponse))
    }
    return new Response(JSON.stringify(finalResponse))
  }).catch(error => {
    return new Response('Error fetching data', { status: 500 })
  }))
}

function cacheResponse(event, cacheRequest) {
  event.respondWith(
    caches.match(cacheRequest).then(response => {
      return response || fetch(event.request).then(responseF => {
        return caches.open(cacheID).then(cache => {
          if (responseF.url.indexOf('browser-sync') === -1) {
            cache.put(event.request, responseF.clone())
          }
          return responseF
        }).catch(error => {
          if (event.request.url.indexOf('.jpg') > -1) {
            return caches.match('/img/undefined.png')
          }
          return new Response('Application is not connected to the internet', {
            status: 404,
            statusText: 'Application is not connected to the internet'
          })
        })
      })
    })
  )
}
