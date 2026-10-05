export interface Notification {
  id: string
  title: string
  message: string
  date: string
  read: boolean
}

export interface Message {
  id: string
  sender: string
  content: string
  timestamp: string
  read: boolean
}

export interface Booking {
  id: string
  title: string
  provider: string
  date: string
  status: string
  image: string
  rating?: number
}

export interface Service {
  id: string
  title: string
  provider: string
  price: string
  rating: number
  image: string
}

export interface Provider {
  id: string
  name: string
  type: string
  experience: string
  date: string
  image: string
}

export interface Report {
  id: string
  reporter: string
  reported: string
  reason: string
  date: string
  status: string
}

