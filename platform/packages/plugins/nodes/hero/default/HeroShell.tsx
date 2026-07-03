import './hero.css'
import { useState }                        from 'react'
import { Link }                             from 'react-router-dom'
import { useLocale, useT, useResolveLocale } from '@statdash/react'
import type { NodeRenderer }                 from '@statdash/react/engine'
import type { HeroNode }                     from './HeroNode'
import { HeroGraphic }                       from './HeroGraphic'

// Owner: hero subtitle + card subs hidden at this stage; content preserved in config. Flip to re-enable.
const SHOW_HERO_SUBTITLES = false

export const HeroShell: NodeRenderer<HeroNode> = (def, _ctx, _children) =>
  <HeroControl def={def} />

function HeroControl({ def }: { def: HeroNode }) {
  const [activeCard, setActiveCard] = useState(0)
  const locale  = useLocale()
  const t       = useT('hero')
  const resolve = useResolveLocale()
  const active  = def.cards[activeCard]

  return (
    <section className="hero">
      <div className="hero__bg" style={{ background: active?.pageBg }} />
      <HeroGraphic />

      <div className="hero__container">
        <h1 className="hero__title">
          {resolve(def.title).split('\n').map((line, i) => (
            i === 0
              ? <span key={i}>{line}</span>
              : <span key={i}><br />{line}</span>
          ))}
        </h1>
        {SHOW_HERO_SUBTITLES && def.subtitle && (
          <p className="hero__subtitle">{resolve(def.subtitle)}</p>
        )}

        <div className="hero__cards">
          {def.cards.map((card, index) => (
            <div
              key={card.id}
              onClick={() => setActiveCard(index)}
              className="hero-card"
              data-current={activeCard === index ? '' : undefined}
              style={{ '--card-accent': card.color } as React.CSSProperties}
            >
              <img
                src={card.img}
                alt={resolve(card.title)}
                className="hero-card__media"
              />
              <div className="hero-card__body">
                <div className="hero-card__title">{resolve(card.title)}</div>
                {SHOW_HERO_SUBTITLES && card.sub && (
                  <div className="hero-card__sub">{resolve(card.sub)}</div>
                )}
                <Link to={`/${locale}/${card.id}`} className="hero-card__button">
                  {t('view')}
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}