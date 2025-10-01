import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";

const DesignPicker = () => {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 flex items-center justify-center p-6 pt-24">
        <div className="max-w-6xl w-full">
          <h1 className="text-5xl font-bold text-center mb-4">Выберите дизайн</h1>
          <p className="text-xl text-muted-foreground text-center mb-16">
            Мы подготовили 3 варианта дизайна главной страницы
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                title: "Дизайн 1: Современный градиент",
                desc: "Яркий, динамичный дизайн с градиентами и эффектами свечения",
                url: "/design1",
                features: ["Градиентные элементы", "Статистика пользователей", "Карточки с эффектами"]
              },
              {
                title: "Дизайн 2: Минимализм",
                desc: "Чистый, элегантный дизайн в стиле минимализма",
                url: "/design2",
                features: ["Простота и ясность", "Крупная типографика", "Боковое сравнение"]
              },
              {
                title: "Дизайн 3: 3D-эффекты",
                desc: "Динамичный дизайн с анимированными элементами и глубиной",
                url: "/design3",
                features: ["Анимированные орбы", "3D-эффекты карточек", "Социальное доказательство"]
              }
            ].map((design, i) => (
              <div key={i} className="border-2 border-border rounded-2xl p-8 hover:border-primary transition-all group">
                <h3 className="text-2xl font-bold mb-4">{design.title}</h3>
                <p className="text-muted-foreground mb-6">{design.desc}</p>
                <ul className="space-y-2 mb-8">
                  {design.features.map((feature, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <span className="text-primary">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link to={design.url}>
                  <Button className="w-full group-hover:bg-primary group-hover:text-primary-foreground">
                    Посмотреть дизайн
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DesignPicker;
