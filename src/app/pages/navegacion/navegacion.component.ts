import { Component, OnInit, ElementRef, ViewChildren, QueryList, AfterViewInit, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';

interface ChatBot {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  icon: string;
  gradientClass: string;
  cardClass: string;
  features: string[];
  isVisible?: boolean;
}

@Component({
  selector: 'app-navegacion',
  standalone: true,
  imports: [CommonModule, RouterModule], 
  templateUrl: './navegacion.component.html',
  styleUrls: ['./navegacion.component.css'],
  schemas: [CUSTOM_ELEMENTS_SCHEMA] // 👈 Esto es lo que hace que <dotlottie-wc> no de error
})
export class NavegacionComponent implements OnInit, AfterViewInit {
  @ViewChildren('chatSection') chatSections!: QueryList<ElementRef>;

  isTransitioning = false;

  chatbots: ChatBot[] = [
    {
      id: 'openai',
      title: 'FoodBot Assistant',
      subtitle: 'Chat inteligente con IA',
      description: 'Conversa naturalmente sobre nuestro negocio, haz preguntas y recibe respuestas inteligentes. Nuestro asistente utiliza la tecnología más avanzada para brindarte información precisa y personalizada.',
      icon: '🤖',
      gradientClass: 'openai-gradient',
      cardClass: 'openai-shadow',
      isVisible: false,
      features: [
        'Conversación natural y fluida',
        'Respuestas inteligentes en tiempo real',
        'Soporte para mensajes de voz',
        'Información completa del negocio'
      ]
    },
    {
      id: 'vision',
      title: 'Food Vision',
      subtitle: 'Reconocimiento de comida',
      description: 'Sube una imagen de comida y nuestro modelo entrenado te dirá exactamente qué es. Utilizamos inteligencia artificial avanzada para identificar platillos, ingredientes y características nutricionales.',
      icon: '👁️',
      gradientClass: 'vision-gradient',
      cardClass: 'vision-shadow',
      isVisible: false,
      features: [
        'Reconocimiento IA de última generación',
        'Análisis detallado de imágenes',
        'Modelo entrenado especializado',
        'Identificación precisa y rápida'
      ]
    },
    {
      id: 'generator',
      title: 'Food Creator',
      subtitle: 'Generador de imágenes',
      description: 'Describe cualquier platillo y nuestra IA creará una imagen realista para ti. Perfecto para visualizar nuevas recetas, presentaciones de menús o inspiración culinaria.',
      icon: '🎨',
      gradientClass: 'generator-gradient',
      cardClass: 'generator-shadow',
      isVisible: false,
      features: [
        'Generación IA de imágenes',
        'Resultados únicos y creativos',
        'Prompts inteligentes y detallados',
        'Calidad profesional garantizada'
      ]
    }
  ];

  private observer!: IntersectionObserver;

  constructor(private router: Router) {}

  ngOnInit(): void {
    console.log('Navigation Hub inicializado');
  }

  ngAfterViewInit(): void {
    this.setupScrollAnimations();
  }

  private setupScrollAnimations(): void {
    const options = {
      root: null,
      rootMargin: '-20% 0px -20% 0px',
      threshold: 0.3
    };

    this.observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const sectionIndex = parseInt(entry.target.getAttribute('data-index') || '0');

        if (entry.isIntersecting) {
          setTimeout(() => {
            this.chatbots[sectionIndex].isVisible = true;
          }, sectionIndex * 300);
        }
      });
    }, options);

    setTimeout(() => {
      this.chatSections.forEach((sectionElement) => {
        this.observer.observe(sectionElement.nativeElement);
      });
    }, 100);
  }

  handleChatClick(chatbot: ChatBot): void {
    if (this.isTransitioning) return;

    console.log(`Navegando a: ${chatbot.id}`);
    this.isTransitioning = true;

    setTimeout(() => {
      this.navigateToChat(chatbot.id);
    }, 3000);
  }

  private navigateToChat(chatbotId: string): void {
    switch (chatbotId) {
      case 'openai':
        this.router.navigate(['/chatbot']);
        break;
      case 'vision':
        this.router.navigate(['/chat-vision']);
        break;
      case 'generator':
        this.router.navigate(['/chat-generator']);
        break;
      default:
        console.error(`Ruta no definida para: ${chatbotId}`);
    }

    this.isTransitioning = false;
  }

  ngOnDestroy(): void {
    if (this.observer) {
      this.observer.disconnect();
    }
  }
}
