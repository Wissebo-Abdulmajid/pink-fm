import {
  Cloud,
  Coffee,
  Flame,
  Gem,
  Heart,
  History,
  Radio,
  Sparkles,
  Sun,
  Zap,
  type LucideProps,
} from 'lucide-react'

const icons: Record<string, (props: LucideProps) => React.ReactNode> = {
  cloud: (props) => <Cloud {...props} />,
  coffee: (props) => <Coffee {...props} />,
  flame: (props) => <Flame {...props} />,
  gem: (props) => <Gem {...props} />,
  heart: (props) => <Heart {...props} />,
  history: (props) => <History {...props} />,
  radio: (props) => <Radio {...props} />,
  sparkles: (props) => <Sparkles {...props} />,
  sun: (props) => <Sun {...props} />,
  zap: (props) => <Zap {...props} />,
}

export function MoodIcon({ name, ...props }: { name: string } & LucideProps) {
  return <>{(icons[name] ?? icons.radio)?.(props)}</>
}
