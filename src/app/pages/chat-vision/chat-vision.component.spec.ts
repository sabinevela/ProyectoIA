import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ChatVisionComponent } from './chat-vision.component';

describe('ChatVisionComponent', () => {
  let component: ChatVisionComponent;
  let fixture: ComponentFixture<ChatVisionComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatVisionComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ChatVisionComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
