import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

const firebaseConfig = {
  apiKey: 'AIzaSyD0HOmZjHOXUNmX-ADjp0lh7AyyEF7quhs',
  authDomain: 'guessmynum.firebaseapp.com',
  databaseURL: 'https://guessmynum-default-rtdb.firebaseio.com',
  projectId: 'guessmynum',
  storageBucket: 'guessmynum.firebasestorage.app',
  messagingSenderId: '738422329905',
  appId: '1:738422329905:web:ba1ca8b849ec4c9b6ebb10',
}

const app = initializeApp(firebaseConfig)
export const db = getDatabase(app)
