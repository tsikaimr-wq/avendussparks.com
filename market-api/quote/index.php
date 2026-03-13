<?php
declare(strict_types=1);

require dirname(__DIR__) . '/common.php';

market_api_forward('/quote', ['symbol', 'pid', 'name']);
