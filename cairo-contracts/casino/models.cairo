#[dojo::model]
#[derive(Copy, Drop, Serde)]
pub struct CoinTossGame {
    #[key]
    pub token_id: u64,
    pub choice: u8,     // 0 = heads, 1 = tails
    pub result: u8,     // 0 = heads, 1 = tails
    pub won: bool,
    pub over: bool,
    pub score: u32,     // 0 = lost, 2 = won (2x multiplier)
}
