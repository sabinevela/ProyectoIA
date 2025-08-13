import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { LoginComponent } from './pages/login/login.component';
import { RegisterComponent } from './pages/register/register.component';
import { ChatbotComponent } from './pages/chatbot/chatbot.component';
import { NavegacionComponent } from './pages/navegacion/navegacion.component';

export const routes: Routes = [
  { path: '', component: HomeComponent },
  { path: 'navegacion', component: NavegacionComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'chatbot', component: ChatbotComponent }
];
