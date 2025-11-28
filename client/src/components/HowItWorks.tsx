import { MessageSquare, Bot, Users } from "lucide-react";

const steps = [
  {
    icon: MessageSquare,
    title: "Ask",
    description: "Paste any headline or claim",
  },
  {
    icon: Bot,
    title: "Verify",
    description: "Our agentic AI + tools investigate",
  },
  {
    icon: Users,
    title: "Trust",
    description: "Peers upvote/downvote the answer",
  },
];

export default function HowItWorks() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12" data-testid="how-it-works">
      {steps.map((step, index) => (
        <div
          key={step.title}
          className="flex flex-col items-center text-center"
          data-testid={`step-${index + 1}`}
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <step.icon className="h-7 w-7 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-2">{step.title}</h3>
          <p className="text-sm text-muted-foreground">{step.description}</p>
        </div>
      ))}
    </div>
  );
}
