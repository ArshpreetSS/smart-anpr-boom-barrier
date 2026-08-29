import os
import random
import numpy as np
import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import Dataset, DataLoader
from PIL import Image, ImageDraw, ImageFont, ImageFilter

CLASSES = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
NUM_CLASSES = len(CLASSES)
CHAR_TO_IDX = {c: i for i, c in enumerate(CLASSES)}
IDX_TO_CHAR = {i: c for i, c in enumerate(CLASSES)}

class CharacterCNN(nn.Module):
    def __init__(self, num_classes=36):
        super(CharacterCNN, self).__init__()
        self.features = nn.Sequential(
            nn.Conv2d(1, 32, kernel_size=3, padding=1),
            nn.BatchNorm2d(32),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),  # 32x32 -> 16x16
            
            nn.Conv2d(32, 64, kernel_size=3, padding=1),
            nn.BatchNorm2d(64),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),  # 16x16 -> 8x8
            
            nn.Conv2d(64, 128, kernel_size=3, padding=1),
            nn.BatchNorm2d(128),
            nn.ReLU(inplace=True),
            nn.MaxPool2d(2, 2),  # 8x8 -> 4x4
        )
        self.classifier = nn.Sequential(
            nn.Dropout(0.35),
            nn.Linear(128 * 4 * 4, 256),
            nn.ReLU(inplace=True),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes)
        )
        
    def forward(self, x):
        x = self.features(x)
        x = torch.flatten(x, 1)
        x = self.classifier(x)
        return x

class CharlesWrightCharacterDataset(Dataset):
    def __init__(self, samples_per_class=350, img_size=32):
        self.samples_per_class = samples_per_class
        self.img_size = img_size
        self.data = []
        
        # Charles Wright font paths prioritized
        self.primary_font = 'models/character_recognition/fonts/CharlesWright-Bold.otf' if os.path.exists('models/character_recognition/fonts/CharlesWright-Bold.otf') else 'models/fonts/CharlesWright-Bold.otf'
        
        secondary_candidates = [
            'C:/Windows/Fonts/segoeuib.ttf',
            'C:/Windows/Fonts/arialbd.ttf',
            'C:/Windows/Fonts/calibrib.ttf',
            'C:/Windows/Fonts/consolab.ttf'
        ]
        self.secondary_fonts = [f for f in secondary_candidates if os.path.exists(f)]
        self._generate_dataset()
        
    def _generate_dataset(self):
        print(f"Generating Charles Wright font character dataset ({self.samples_per_class * NUM_CLASSES} samples)...")
        for char_idx, char in enumerate(CLASSES):
            for _ in range(self.samples_per_class):
                img = self._create_char_image(char)
                img_np = np.array(img, dtype=np.float32) / 255.0  # normalize [0, 1]
                tensor_img = torch.tensor(img_np, dtype=torch.float32).unsqueeze(0)
                self.data.append((tensor_img, char_idx))
        random.shuffle(self.data)
        
    def _create_char_image(self, char):
        img_size = self.img_size
        # Render canvas (white character on black background for CNN)
        img = Image.new('L', (img_size * 2, img_size * 2), color=0)
        draw = ImageDraw.Draw(img)
        
        # 80% Charles Wright font, 20% complementary bold fonts
        use_charles_wright = (random.random() < 0.82) and os.path.exists(self.primary_font)
        font_path = self.primary_font if use_charles_wright else (random.choice(self.secondary_fonts) if self.secondary_fonts else self.primary_font)
        font_size = random.randint(int(img_size * 1.15), int(img_size * 1.55))
        
        try:
            font = ImageFont.truetype(font_path, font_size)
        except Exception:
            font = ImageFont.load_default()
            
        bbox = draw.textbbox((0, 0), char, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        
        # Center in 64x64 canvas
        x = (img_size * 2 - text_w) // 2 - bbox[0]
        y = (img_size * 2 - text_h) // 2 - bbox[1]
        
        # Random positional jitter
        x += random.randint(-2, 2)
        y += random.randint(-2, 2)
        
        draw.text((x, y), char, fill=255, font=font)
        
        # Data Augmentations
        # 1. Random Rotation (-10 to +10 deg)
        if random.random() < 0.7:
            angle = random.uniform(-10.0, 10.0)
            img = img.rotate(angle, resample=Image.BILINEAR)
            
        # 2. Random crop back to 32x32 center
        left = (img_size * 2 - img_size) // 2
        top = (img_size * 2 - img_size) // 2
        img = img.crop((left, top, left + img_size, top + img_size))
        
        # 3. Random blur (lens defocus simulation)
        if random.random() < 0.25:
            img = img.filter(ImageFilter.GaussianBlur(radius=random.uniform(0.3, 0.8)))
            
        # 4. Random noise injection
        if random.random() < 0.35:
            np_img = np.array(img, dtype=np.float32)
            noise = np.random.normal(0, random.uniform(8, 22), np_img.shape)
            np_img = np.clip(np_img + noise, 0, 255).astype(np.uint8)
            img = Image.fromarray(np_img)
            
        # 5. Random brightness/contrast threshold jitter
        if random.random() < 0.3:
            np_img = np.array(img, dtype=np.float32)
            gain = random.uniform(0.85, 1.25)
            np_img = np.clip(np_img * gain, 0, 255).astype(np.uint8)
            img = Image.fromarray(np_img)
            
        return img
        
    def __len__(self):
        return len(self.data)
        
    def __getitem__(self, idx):
        return self.data[idx]

def train_charles_wright_cnn():
    os.makedirs('models', exist_ok=True)
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Training Charles Wright CharacterCNN on {device}...")
    
    dataset = CharlesWrightCharacterDataset(samples_per_class=350, img_size=32)
    train_size = int(0.88 * len(dataset))
    val_size = len(dataset) - train_size
    train_set, val_set = torch.utils.data.random_split(dataset, [train_size, val_size])
    
    train_loader = DataLoader(train_set, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_set, batch_size=64, shuffle=False)
    
    model = CharacterCNN(num_classes=NUM_CLASSES).to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=0.0015, weight_decay=1e-4)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', patience=2, factor=0.5)
    
    epochs = 12
    best_acc = 0.0
    
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            correct += torch.sum(preds == labels.data).item()
            total += labels.size(0)
            
        train_loss = running_loss / total
        train_acc = (correct / total) * 100.0
        
        # Validation
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, preds = torch.max(outputs, 1)
                val_correct += torch.sum(preds == labels.data).item()
                val_total += labels.size(0)
                
        val_acc = (val_correct / val_total) * 100.0
        scheduler.step(val_acc)
        
        print(f"Epoch [{epoch+1:02d}/{epochs:02d}] Train Loss: {train_loss:.4f} | Train Acc: {train_acc:.2f}% | Val Acc: {val_acc:.2f}%")
        
        if val_acc > best_acc:
            best_acc = val_acc
            save_path = 'models/character_recognition/ocr_model.pth'
            os.makedirs(os.path.dirname(save_path), exist_ok=True)
            torch.save(model.state_dict(), save_path)
            
    print(f"\n[DONE] Successfully trained Charles Wright CharacterCNN! Best Val Acc: {best_acc:.2f}%")
    print(f"Model weights saved to models/character_recognition/ocr_model.pth")

if __name__ == '__main__':
    train_charles_wright_cnn()
