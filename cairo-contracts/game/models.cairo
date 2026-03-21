// -- Dojo Models --
// Each #[dojo::model] struct is an ECS component stored on-chain and auto-indexed by Torii.

use starknet::ContractAddress;

#[derive(Copy, Drop, Serde, Debug)]
// Generates read/write traits (ModelStorage) and registers the schema with Torii.
#[dojo::model]
pub struct Player {
    // Primary key — each wallet address maps to exactly one Player entity.
    #[key]
    pub player: ContractAddress,
    pub x: u8,
    pub y: u8,
    pub health: u8,
    pub gold: u32,
    pub level: u32,
    pub dug: felt252, // 100-bit bitmap, bit y*10+x = tile has been dug
    pub best: u32, // highest gold reached
}

// Introspect makes this enum serializable to/from Starknet calldata.
#[derive(Serde, Copy, Drop, Introspect, PartialEq, Debug)]
pub enum Direction {
    Left,
    Right,
    Up,
    Down,
}

// Transient enum — not stored in ECS, only used within dig logic and emitted in events.
#[derive(Copy, Drop, Serde, PartialEq, Introspect)]
pub enum Tile {
    Empty,
    Gold,
    Bomb,
}
