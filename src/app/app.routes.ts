import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { ChatbotComponent } from './pages/chatbot/chatbot.component';
import { NavegacionComponent } from './pages/navegacion/navegacion.component';
import { ChatVisionComponent } from './pages/chat-vision/chat-vision.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'navegacion', component: NavegacionComponent },
  { path: 'chatbot', component: ChatbotComponent },
  { path: 'chatvision', component: ChatVisionComponent }

];
