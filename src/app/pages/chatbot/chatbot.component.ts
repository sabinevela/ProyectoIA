import { Component, ElementRef, ViewChild, AfterViewChecked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface ChatMessage {
  user: boolean;
  type: 'text' | 'image';
  content: string;
  timestamp?: Date;
}

type OrderState = 'waiting' | 'askingProduct' | 'askingQuantity' | 'confirming';

@Component({
  selector: 'app-chatbot',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chatbot.component.html',
  styleUrls: ['./chatbot.component.css']
})
export class ChatbotComponent implements AfterViewChecked {
  @ViewChild('chatBox') private chatBox!: ElementRef<HTMLDivElement>;

  userInput = '';
  messages: ChatMessage[] = [];
  isTyping = false;

  orderState: OrderState = 'waiting';
  currentOrder = { product: '', quantity: 0 };

  private readonly botResponses = {
    greeting: [
      '¡Hola! Soy FoodBot, tu asistente culinario personal. ¿En qué puedo ayudarte hoy?',
      '¡Bienvenido! Estoy aquí para ayudarte con tus pedidos de comida. ¿Qué te gustaría ordenar?',
      '¡Hola! ¿Listo para descubrir deliciosas opciones? ¿Qué puedo preparar para ti?'
    ],
    menu: [
      '🍕 Pizza Margherita - $12.99\n🍔 Hamburguesa Clásica - $9.99\n🥗 Ensalada César - $8.50\n🍝 Pasta Carbonara - $11.50\n🌮 Tacos Mexicanos - $10.99\n\n¿Qué te llama la atención?',
      'Aquí tienes nuestro menú destacado:\n\n🍕 Pizzas artesanales\n🍔 Hamburguesas gourmet\n🥗 Ensaladas frescas\n🍝 Pastas caseras\n🌮 Comida mexicana\n🍣 Sushi fresco\n\n¿Sobre qué categoría quieres saber más?'
    ],
    help: [
      'Puedo ayudarte con:\n• 📋 Ver nuestro menú completo\n• 🛒 Realizar pedidos paso a paso\n• 📷 Analizar imágenes de comida\n• ❓ Responder dudas sobre ingredientes\n• 🚚 Información de delivery\n\n¿En qué te puedo asistir?',
      'Estoy aquí para hacer tu experiencia más fácil:\n\n✨ Recomendaciones personalizadas\n🔍 Búsqueda por ingredientes\n⏱️ Tiempos de preparación\n💰 Información de precios\n📍 Zonas de entrega\n\n¿Qué necesitas saber?'
    ]
  };

  sendMessage(): void {
    if (!this.userInput.trim() || this.isTyping) return;

    this.addMessage(true, 'text', this.userInput.trim());
    const userMsg = this.userInput.trim().toLowerCase();
    this.userInput = '';

    this.simulateTyping();

    setTimeout(() => {
      this.handleOrderFlow(userMsg);
      this.stopTyping();
      this.scrollToBottom();
    }, this.getRandomDelay(800, 2000));
  }

  sendQuickMessage(message: string): void {
    if (this.isTyping) return;

    this.userInput = message;
    this.sendMessage();
  }

  onImageUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length || this.isTyping) return;

    const file = input.files[0];
    if (file.size > 5 * 1024 * 1024) {
      this.addMessage(false, 'text', 'La imagen es muy grande. Por favor, sube una imagen menor a 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.addMessage(true, 'image', reader.result as string);
      this.simulateTyping();

      setTimeout(() => {
        const responses = [
          '¡Imagen recibida! Se ve delicioso. ¿Te gustaría pedir algo similar?',
          '¡Excelente foto! ¿Quieres que te recomiende algo parecido de nuestro menú?',
          'Me encanta lo que veo en la imagen. ¿Puedo sugerirte algunas opciones similares?'
        ];
        this.addMessage(false, 'text', this.getRandomResponse(responses));
        this.stopTyping();
        this.scrollToBottom();
      }, this.getRandomDelay(1000, 2000));
    };

    reader.onerror = () => {
      this.addMessage(false, 'text', 'Hubo un error al procesar la imagen. Por favor, intenta de nuevo.');
    };

    reader.readAsDataURL(file);
    input.value = '';
  }

  handleOrderFlow(message: string): void {
    switch (this.orderState) {
      case 'waiting':
        this.handleWaitingState(message);
        break;
      case 'askingProduct':
        this.handleProductState(message);
        break;
      case 'askingQuantity':
        this.handleQuantityState(message);
        break;
      case 'confirming':
        this.handleConfirmingState(message);
        break;
    }
  }

  private handleWaitingState(message: string): void {
    if (this.containsWords(message, ['menú', 'menu', 'carta', 'opciones', 'ver'])) {
      this.addMessage(false, 'text', this.getRandomResponse(this.botResponses.menu));
    } else if (this.containsWords(message, ['ayuda', 'help', 'que puedes', 'como funciona'])) {
      this.addMessage(false, 'text', this.getRandomResponse(this.botResponses.help));
    } else if (this.containsWords(message, ['pedido', 'pedir', 'ordenar', 'quiero', 'comprar'])) {
      this.addMessage(false, 'text', '¡Perfecto! ¿Qué producto te gustaría pedir? Puedes decirme el nombre o elegir del menú.');
      this.orderState = 'askingProduct';
    } else if (this.containsWords(message, ['hola', 'buenas', 'hello', 'hi'])) {
      this.addMessage(false, 'text', this.getRandomResponse(this.botResponses.greeting));
    } else {
      this.addMessage(false, 'text', '¡Hola! ¿Te gustaría ver nuestro menú, hacer un pedido o necesitas ayuda con algo más?');
      this.orderState = 'askingProduct';
    }
  }

  private handleProductState(message: string): void {
    if (this.containsWords(message, ['cancelar', 'salir', 'no quiero', 'atrás'])) {
      this.addMessage(false, 'text', 'Pedido cancelado. ¿Hay algo más en lo que pueda ayudarte?');
      this.resetOrder();
      return;
    }

    this.currentOrder.product = this.formatProductName(message);
    this.addMessage(false, 'text',
      `Excelente elección: "${this.currentOrder.product}" 👌\n\n¿Cuántas unidades deseas? Por favor, ingresa solo el número.`
    );
    this.orderState = 'askingQuantity';
  }

  private handleQuantityState(message: string): void {
    const qty = parseInt(message);

    if (isNaN(qty) || qty <= 0) {
      this.addMessage(false, 'text',
        'Por favor, ingresa un número válido mayor que cero. Ejemplo: 2, 5, 10'
      );
      return;
    }

    if (qty > 50) {
      this.addMessage(false, 'text',
        'Para pedidos de más de 50 unidades, por favor contacta directamente con nosotros. ¿Quieres ajustar la cantidad?'
      );
      return;
    }

    this.currentOrder.quantity = qty;
    const unitText = qty === 1 ? 'unidad' : 'unidades';

    this.addMessage(false, 'text',
      `📋 Resumen de tu pedido:\n• Producto: ${this.currentOrder.product}\n• Cantidad: ${qty} ${unitText}\n\n¿Confirmas este pedido? (Responde: sí/no)`
    );
    this.orderState = 'confirming';
  }

  private handleConfirmingState(message: string): void {
    if (this.containsWords(message, ['sí', 'si', 'yes', 'confirmo', 'correcto', 'ok'])) {
      const orderNumber = this.generateOrderNumber();
      this.addMessage(false, 'text',
        `🎉 ¡Pedido confirmado exitosamente!\n\n📦 Número de orden: #${orderNumber}\n⏱️ Tiempo estimado: 25-35 minutos\n💰 Total estimado: Consultar al recibir\n\n¿Te gustaría pedir algo más?`
      );
      this.resetOrder();
    } else if (this.containsWords(message, ['no', 'cancelar', 'cambiar'])) {
      this.addMessage(false, 'text',
        'Pedido cancelado. ¿Te gustaría hacer un nuevo pedido o hay algo más en lo que pueda ayudarte?'
      );
      this.resetOrder();
    } else {
      this.addMessage(false, 'text',
        'Por favor, responde "sí" para confirmar o "no" para cancelar el pedido.'
      );
    }
  }

  private addMessage(user: boolean, type: 'text' | 'image', content: string): void {
    this.messages.push({
      user,
      type,
      content,
      timestamp: new Date()
    });
  }

  private simulateTyping(): void {
    this.isTyping = true;
  }

  private stopTyping(): void {
    this.isTyping = false;
  }

  private resetOrder(): void {
    this.orderState = 'waiting';
    this.currentOrder = { product: '', quantity: 0 };
  }

  private containsWords(text: string, words: string[]): boolean {
    const normalizedText = this.normalizeText(text);
    return words.some(word => normalizedText.includes(this.normalizeText(word)));
  }

  private normalizeText(text: string): string {
    return text.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  }

  private formatProductName(product: string): string {
    return product.charAt(0).toUpperCase() + product.slice(1).toLowerCase();
  }

  private getRandomResponse(responses: string[]): string {
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private getRandomDelay(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  private generateOrderNumber(): string {
    return Math.random().toString(36).substr(2, 9).toUpperCase();
  }

  getCurrentTime(): string {
    return new Date().toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  ngAfterViewChecked(): void {
    this.scrollToBottom();
  }

  private scrollToBottom(): void {
    try {
      const element = this.chatBox.nativeElement;
      element.scrollTop = element.scrollHeight;
    } catch (err) {
      console.error('Error scrolling to bottom:', err);
    }
  }
}
